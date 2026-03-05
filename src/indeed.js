const { clamp, pickDefined, sleep } = require('./utils');

const INDEED_SEARCH_URL = 'https://www.indeed.com/jobs';
const DEFAULT_MAX_RESULTS = 50;
const ABSOLUTE_MAX_RESULTS = 200;
const PAGE_SIZE = 10;

function defaultHeaders() {
    return {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
    };
}

function buildSearchUrl(search, start = 0) {
    const query = new URLSearchParams(
        pickDefined({
            q: search.query,
            l: search.location,
            fromage: search.fromDays ?? 1,
            start: start > 0 ? String(start) : undefined,
        }),
    );

    return `${INDEED_SEARCH_URL}?${query.toString()}`;
}

function getJobId(job) {
    return job?.id || job?.jobKey || job?.jobkey || job?.jk || null;
}

function isJobLike(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const hasId = typeof getJobId(value) === 'string';
    if (!hasId) return false;

    return Boolean(
        value.title || value.displayTitle || value.company || value.truncatedCompany || value.jobDescription || value.formattedLocation,
    );
}

function findJobArrays(node, out, depth = 0) {
    if (!node || depth > 14) return;

    if (Array.isArray(node)) {
        if (node.length > 0 && node.every((item) => typeof item === 'object' && item !== null) && node.some(isJobLike)) {
            out.push(node.filter(isJobLike));
        }

        for (const item of node) {
            findJobArrays(item, out, depth + 1);
        }
        return;
    }

    if (typeof node === 'object') {
        for (const value of Object.values(node)) {
            findJobArrays(value, out, depth + 1);
        }
    }
}

function decodeHtmlEntities(text) {
    return text
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

function extractBalancedSegment(text, startIndex, openChar, closeChar) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i += 1) {
        const ch = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === openChar) {
            depth += 1;
            continue;
        }

        if (ch === closeChar) {
            depth -= 1;
            if (depth === 0) {
                return text.slice(startIndex, i + 1);
            }
        }
    }

    return null;
}

function extractJsonCandidatesFromHtml(html) {
    const candidates = [];

    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptPattern.exec(html)) !== null) {
        const scriptContent = scriptMatch[1]?.trim();
        if (!scriptContent) continue;

        if (scriptContent.startsWith('{') || scriptContent.startsWith('[')) {
            candidates.push(scriptContent);
        }

        const assignPattern = /(window\.[A-Za-z0-9_$.]+\s*=\s*)(\{|\[)/g;
        let assignMatch;
        while ((assignMatch = assignPattern.exec(scriptContent)) !== null) {
            const opening = assignMatch[2];
            const absoluteStart = assignMatch.index + assignMatch[1].length;
            const segment = extractBalancedSegment(
                scriptContent,
                absoluteStart,
                opening,
                opening === '{' ? '}' : ']',
            );
            if (segment) candidates.push(segment);
        }
    }

    const resultIndex = html.indexOf('"results":[');
    if (resultIndex >= 0) {
        const arrayStart = html.indexOf('[', resultIndex);
        if (arrayStart >= 0) {
            const arraySegment = extractBalancedSegment(html, arrayStart, '[', ']');
            if (arraySegment) {
                candidates.push(arraySegment);
                candidates.push(`{"results":${arraySegment}}`);
            }
        }
    }

    return candidates;
}

function parseJobsFromHtml(html) {
    const candidates = extractJsonCandidatesFromHtml(html);
    const foundArrays = [];

    for (const raw of candidates) {
        try {
            const parsed = JSON.parse(decodeHtmlEntities(raw));
            findJobArrays(parsed, foundArrays);
        } catch {
            // Ignore non-JSON script content.
        }
    }

    if (foundArrays.length === 0) return [];

    const selected = foundArrays.sort((a, b) => b.length - a.length)[0];
    const seen = new Set();
    const unique = [];

    for (const job of selected) {
        const id = getJobId(job);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        unique.push(job);
    }

    return unique;
}

async function fetchText(url, { retries = 2, retryMs = 600 } = {}) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await fetch(url, { headers: defaultHeaders() });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                await sleep(retryMs * (attempt + 1));
            }
        }
    }

    throw lastError;
}

async function scrapeIndeedJobs(input, warnings = []) {
    const allJobs = [];
    const seenIds = new Set();

    for (const search of input.searches || []) {
        const maxResults = clamp(search.maxResults ?? DEFAULT_MAX_RESULTS, 1, ABSOLUTE_MAX_RESULTS);
        let collected = 0;
        let start = 0;

        while (collected < maxResults) {
            const url = buildSearchUrl(search, start);
            let html;

            try {
                html = await fetchText(url);
            } catch (error) {
                warnings.push({
                    type: 'search_page_fetch_failed',
                    url,
                    message: String(error.message || error),
                });
                break;
            }

            const pageJobs = parseJobsFromHtml(html);
            if (pageJobs.length === 0) {
                break;
            }

            let pageAdds = 0;
            for (const job of pageJobs) {
                const id = getJobId(job);
                if (!id || seenIds.has(id)) continue;
                seenIds.add(id);
                allJobs.push(job);
                collected += 1;
                pageAdds += 1;

                if (collected >= maxResults) break;
            }

            if (pageJobs.length < PAGE_SIZE || pageAdds === 0) {
                break;
            }

            start += PAGE_SIZE;
            if (start > 1000) break;
        }
    }

    return allJobs;
}

module.exports = {
    buildSearchUrl,
    getJobId,
    parseJobsFromHtml,
    scrapeIndeedJobs,
};