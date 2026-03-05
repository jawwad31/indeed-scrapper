const test = require('node:test');
const assert = require('node:assert/strict');

const { enrichJobsWithCompanyInfo } = require('../src/company');

test('enrichJobsWithCompanyInfo fetches a repeated company page once per run', async () => {
    let fetchCount = 0;

    const fakeFetch = async () => {
        fetchCount += 1;
        return {
            ok: true,
            text: async () => '<a href="https://www.example.com">Visit website</a>',
        };
    };

    const jobs = [
        {
            id: 'job-1',
            company: 'Example Co',
            companyOverviewLink: 'https://www.indeed.com/cmp/example-co',
            title: 'Assembler',
        },
        {
            id: 'job-2',
            company: 'Example Co',
            companyOverviewLink: 'https://www.indeed.com/cmp/example-co',
            title: 'Operator',
        },
    ];

    const warnings = [];
    const { jobs: enriched } = await enrichJobsWithCompanyInfo(jobs, {
        warnings,
        fetchFn: fakeFetch,
        maxConcurrency: 2,
    });

    assert.equal(fetchCount, 1);
    assert.equal(warnings.length, 0);
    assert.equal(enriched[0].companyInfo.websiteUrl, 'https://www.example.com/');
    assert.equal(enriched[1].companyInfo.websiteUrl, 'https://www.example.com/');
});

test('enrichJobsWithCompanyInfo keeps job when fetch fails', async () => {
    const fakeFetch = async () => {
        throw new Error('timeout');
    };

    const warnings = [];
    const { jobs: enriched } = await enrichJobsWithCompanyInfo(
        [
            {
                id: 'job-1',
                company: 'Fail Co',
                companyOverviewLink: 'https://www.indeed.com/cmp/fail-co',
                title: 'Assembler',
            },
        ],
        { warnings, fetchFn: fakeFetch },
    );

    assert.equal(enriched.length, 1);
    assert.equal(enriched[0].companyInfo.websiteUrl, null);
    assert.equal(enriched[0].companyInfo.websiteSource, 'missing');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].type, 'company_page_fetch_failed');
});