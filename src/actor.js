const { scrapeIndeedJobs } = require('./indeed');
const { enrichJobsWithCompanyInfo } = require('./company');
const { createFetchFn } = require('./http');

function normalizeSearches(input) {
    if (Array.isArray(input.searchUrls) && input.searchUrls.length > 0) {
        const searches = [];

        for (const item of input.searchUrls) {
            if (typeof item === 'string' && item.trim()) {
                searches.push({ url: item.trim() });
            } else if (item && typeof item === 'object' && typeof item.url === 'string' && item.url.trim()) {
                searches.push({
                    url: item.url.trim(),
                    maxResults: item.maxResults,
                });
            }
        }

        return searches;
    }

    const searches = [];

    if (Array.isArray(input.searches)) {
        for (const search of input.searches) {
            if (search && typeof search === 'object') {
                searches.push(search);
            }
        }
    }

    return searches;
}

function validateInput(input, searches) {
    if (!input || typeof input !== 'object') {
        throw new Error('Input must be a JSON object.');
    }

    if (!Array.isArray(searches) || searches.length === 0) {
        throw new Error('Provide at least one search in input.searches or input.searchUrls.');
    }

    for (const [index, search] of searches.entries()) {
        const hasQuery = typeof search.query === 'string' && search.query.trim().length > 0;
        const hasUrl = typeof search.url === 'string' && search.url.trim().length > 0;
        if (!hasQuery && !hasUrl) {
            throw new Error(`Search at index ${index} must include either query or url.`);
        }
    }
}

async function resolveProxyConfiguration(Actor, input) {
    const useApifyProxy = input.useApifyProxy !== false;
    if (!useApifyProxy) return null;

    const groups = Array.isArray(input.proxyGroups) && input.proxyGroups.length > 0
        ? input.proxyGroups
        : undefined;

    return Actor.createProxyConfiguration({ groups });
}

async function runActor(Actor) {
    const warnings = [];

    const input = await Actor.getInput();
    const normalizedSearches = normalizeSearches(input || {});
    validateInput(input, normalizedSearches);

    const proxyConfiguration = await resolveProxyConfiguration(Actor, input);

    const fetchFn = createFetchFn({
        proxyConfiguration,
        proxyUrl: input.proxyUrl,
    });

    const scrapedJobs = await scrapeIndeedJobs(
        { ...input, searches: normalizedSearches },
        warnings,
        { fetchFn },
    );

    const includeCompanyInfo = input.includeCompanyInfo !== false;
    const enrichment = includeCompanyInfo
        ? await enrichJobsWithCompanyInfo(scrapedJobs, {
            warnings,
            maxConcurrency: input.maxConcurrency || 5,
            fetchFn,
        })
        : { jobs: scrapedJobs, companyCache: new Map() };

    if (enrichment.jobs.length > 0) {
        await Actor.pushData(enrichment.jobs);
    }

    await Actor.setValue('RUN_META', {
        processedAt: new Date().toISOString(),
        inputSearchCount: normalizedSearches.length,
        scrapedJobs: scrapedJobs.length,
        outputJobs: enrichment.jobs.length,
        uniqueCompanyOverviewLinks: enrichment.companyCache.size,
        warningCount: warnings.length,
        warnings,
        proxy: {
            useApifyProxy: input.useApifyProxy !== false,
            proxyGroups: input.proxyGroups || [],
            usedRawProxyUrl: Boolean(input.proxyUrl),
        },
    });
}

module.exports = {
    runActor,
};
