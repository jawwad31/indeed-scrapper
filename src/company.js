const { mapLimit } = require('./utils');

const DEFAULT_TIMEOUT_MS = 15000;

function sanitizeAnchorText(html) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function unwrapPossiblyEncodedUrl(url) {
    let value = url;
    for (let i = 0; i < 3; i += 1) {
        try {
            const decoded = decodeURIComponent(value);
            if (decoded === value) break;
            value = decoded;
        } catch {
            break;
        }
    }
    return value;
}

function resolveExternalWebsite(candidate, baseUrl) {
    if (!candidate) return null;

    const cleaned = unwrapPossiblyEncodedUrl(candidate.trim());
    if (!cleaned) return null;

    let url;
    try {
        url = new URL(cleaned, baseUrl);
    } catch {
        return null;
    }

    const host = url.hostname.toLowerCase();
    const indeedHost = host.endsWith('indeed.com') || host.endsWith('indeed.ca') || host.endsWith('indeed.co.uk');
    if (!indeedHost && (url.protocol === 'http:' || url.protocol === 'https:')) {
        return url.href;
    }

    const redirectParams = ['url', 'u', 'dest', 'destination', 'target', 'external', 'externalLink'];
    for (const key of redirectParams) {
        const value = url.searchParams.get(key);
        if (!value) continue;
        const resolved = resolveExternalWebsite(value, baseUrl);
        if (resolved) return resolved;
    }

    return null;
}

function parseWebsiteFromCompanyPageHtml(html, baseUrl) {
    if (!html || typeof html !== 'string') return null;

    const directJsonPatterns = [
        /"websiteUrl"\s*:\s*"([^"]+)"/i,
        /"companyWebsite"\s*:\s*"([^"]+)"/i,
        /"website"\s*:\s*"(https?:\/\/[^"\\]+)"/i,
    ];

    for (const pattern of directJsonPatterns) {
        const match = pattern.exec(html);
        if (!match) continue;
        const normalized = resolveExternalWebsite(match[1].replace(/\\\//g, '/'), baseUrl);
        if (normalized) return normalized;
    }

    const anchorPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let anchorMatch;
    while ((anchorMatch = anchorPattern.exec(html)) !== null) {
        const href = anchorMatch[1];
        const text = sanitizeAnchorText(anchorMatch[2]).toLowerCase();
        const isWebsiteAnchor = text.includes('website') || text.includes('visit site') || text.includes('visit company site');
        if (!isWebsiteAnchor) continue;

        const normalized = resolveExternalWebsite(href, baseUrl);
        if (normalized) return normalized;
    }

    return null;
}

async function fetchCompanyPage(url, fetchFn = fetch) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const response = await fetchFn(url, {
            signal: controller.signal,
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'accept-language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.text();
    } finally {
        clearTimeout(timer);
    }
}

async function enrichJobsWithCompanyInfo(jobs, options = {}) {
    const warnings = options.warnings || [];
    const fetchFn = options.fetchFn || fetch;
    const maxConcurrency = Math.max(1, options.maxConcurrency || 5);
    const companyCache = new Map();

    const enriched = await mapLimit(jobs, maxConcurrency, async (job) => {
        const name = job.company ?? job.truncatedCompany ?? null;
        const companyOverviewLink = job.companyOverviewLink;

        if (!companyOverviewLink) {
            return {
                ...job,
                companyInfo: {
                    name,
                    websiteUrl: null,
                    websiteSource: 'missing',
                    extractedAt: new Date().toISOString(),
                },
            };
        }

        let cachedPromise = companyCache.get(companyOverviewLink);
        if (!cachedPromise) {
            cachedPromise = (async () => {
                try {
                    const html = await fetchCompanyPage(companyOverviewLink, fetchFn);
                    const websiteUrl = parseWebsiteFromCompanyPageHtml(html, companyOverviewLink);
                    return {
                        websiteUrl,
                        websiteSource: websiteUrl ? 'indeed_company_page' : 'missing',
                    };
                } catch (error) {
                    warnings.push({
                        type: 'company_page_fetch_failed',
                        url: companyOverviewLink,
                        message: String(error.message || error),
                    });
                    return {
                        websiteUrl: null,
                        websiteSource: 'missing',
                    };
                }
            })();
            companyCache.set(companyOverviewLink, cachedPromise);
        }

        const cached = await cachedPromise;

        return {
            ...job,
            companyInfo: {
                name,
                websiteUrl: cached.websiteUrl,
                websiteSource: cached.websiteSource,
                extractedAt: new Date().toISOString(),
            },
        };
    });

    return {
        jobs: enriched,
        companyCache,
    };
}

module.exports = {
    enrichJobsWithCompanyInfo,
    parseWebsiteFromCompanyPageHtml,
    resolveExternalWebsite,
};