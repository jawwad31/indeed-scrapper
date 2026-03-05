const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { enrichJobsWithCompanyInfo } = require('../src/company');

const fixturePath = path.join(__dirname, 'fixtures', 'sample-jobs.json');
const sampleJobs = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test('schema compatibility: raw fields remain unchanged and companyInfo is appended', async () => {
    const fakeFetch = async () => ({
        ok: true,
        text: async () => '<html><body><div>no website</div></body></html>',
    });

    const original = sampleJobs[0];
    const originalKeys = Object.keys(original).sort();

    const { jobs: enriched } = await enrichJobsWithCompanyInfo([original], {
        warnings: [],
        fetchFn: fakeFetch,
    });

    const updated = enriched[0];
    const updatedKeys = Object.keys(updated).filter((key) => key !== 'companyInfo').sort();

    assert.deepEqual(updatedKeys, originalKeys);
    assert.equal(updated.companyInfo.name, original.company);
    assert.equal(updated.companyInfo.websiteUrl, null);
    assert.ok(typeof updated.companyInfo.extractedAt === 'string');
});