const test = require('node:test');
const assert = require('node:assert/strict');

const { parseWebsiteFromCompanyPageHtml, resolveExternalWebsite } = require('../src/company');

test('resolveExternalWebsite returns external url directly', () => {
    const result = resolveExternalWebsite('https://www.acme.com', 'https://www.indeed.com/cmp/acme');
    assert.equal(result, 'https://www.acme.com/');
});

test('resolveExternalWebsite unwraps indeed redirect', () => {
    const result = resolveExternalWebsite(
        'https://www.indeed.com/clk?jk=abc&url=https%3A%2F%2Fwww.boisecascade.com%2Fcareers',
        'https://www.indeed.com/cmp/boise-cascade',
    );
    assert.equal(result, 'https://www.boisecascade.com/careers');
});

test('parseWebsiteFromCompanyPageHtml extracts website anchor', () => {
    const html = `
        <html>
            <body>
                <a href="https://www.aprilaire.com">Visit website</a>
            </body>
        </html>
    `;

    const result = parseWebsiteFromCompanyPageHtml(html, 'https://www.indeed.com/cmp/aprilaire');
    assert.equal(result, 'https://www.aprilaire.com/');
});

test('parseWebsiteFromCompanyPageHtml returns null when no website exists', () => {
    const html = '<html><body><div>No website on page</div></body></html>';
    const result = parseWebsiteFromCompanyPageHtml(html, 'https://www.indeed.com/cmp/aprilaire');
    assert.equal(result, null);
});