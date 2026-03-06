function formatFetchError(error) {
    const parts = [];

    if (error?.message) parts.push(error.message);
    if (error?.code) parts.push(`code=${error.code}`);
    if (error?.cause?.code) parts.push(`causeCode=${error.cause.code}`);
    if (error?.cause?.message) parts.push(`causeMessage=${error.cause.message}`);
    if (error?.response?.statusCode) parts.push(`statusCode=${error.response.statusCode}`);

    if (parts.length === 0) {
        return String(error);
    }

    return parts.join(' | ');
}

function createFetchFn({ proxyConfiguration, proxyUrl } = {}) {
    let gotScraping;

    return async (url, options = {}) => {
        if (!gotScraping) {
            ({ gotScraping } = require('got-scraping'));
        }

        let resolvedProxyUrl = null;

        if (proxyConfiguration) {
            resolvedProxyUrl = await proxyConfiguration.newUrl();
        } else if (proxyUrl) {
            resolvedProxyUrl = proxyUrl;
        }

        const response = await gotScraping({
            url,
            headers: options.headers,
            proxyUrl: resolvedProxyUrl || undefined,
            responseType: 'text',
            retry: { limit: 0 },
            http2: false,
            throwHttpErrors: false,
        });

        return {
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            text: async () => response.body,
        };
    };
}

module.exports = {
    createFetchFn,
    formatFetchError,
};
