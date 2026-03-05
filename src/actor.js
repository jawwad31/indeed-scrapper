const { scrapeIndeedJobs } = require('./indeed');
const { enrichJobsWithCompanyInfo } = require('./company');
const { createFetchFn } = require('./http');

function validateInput(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Input must be a JSON object.');
    }

    if (!Array.isArray(input.searches) || input.searches.length === 0) {
        throw new Error('Input.searches must be a non-empty array.');
    }

    for (const [index, search] of input.searches.entries()) {
        if (!search || typeof search !== 'object' || !search.query) {
            throw new Error(`Input.searches[${index}] is missing required field: query`);
        }
    }
}

async function runActor(Actor) {
    const warnings = [];

    const input = await Actor.getInput();
    validateInput(input);

    const fetchFn = createFetchFn(input.proxyUrl);

    const scrapedJobs = await scrapeIndeedJobs(input, warnings, { fetchFn });

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
        inputSearchCount: input.searches.length,
        scrapedJobs: scrapedJobs.length,
        outputJobs: enrichment.jobs.length,
        uniqueCompanyOverviewLinks: enrichment.companyCache.size,
        warningCount: warnings.length,
        warnings,
    });
}

module.exports = {
    runActor,
};
