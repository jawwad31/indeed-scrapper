function formatFetchError(error) {
    const parts = [];

    if (error?.message) parts.push(error.message);
    if (error?.cause?.code) parts.push(`causeCode=${error.cause.code}`);
    if (error?.cause?.message) parts.push(`causeMessage=${error.cause.message}`);

    if (parts.length === 0) {
        return String(error);
    }

    return parts.join(' | ');
}

function createProxyAgentFactory() {
    let ProxyAgent;
    const cache = new Map();

    return {
        create(proxyUrl) {
            if (!proxyUrl) return null;

            if (!ProxyAgent) {
                ({ ProxyAgent } = require('undici'));
            }

            if (!cache.has(proxyUrl)) {
                cache.set(proxyUrl, new ProxyAgent(proxyUrl));
            }

            return cache.get(proxyUrl);
        },
    };
}

function createFetchFn({ proxyConfiguration, proxyUrl } = {}) {
    const proxyAgents = createProxyAgentFactory();

    return async (url, options = {}) => {
        let dispatcher = null;

        if (proxyConfiguration) {
            const requestProxyUrl = await proxyConfiguration.newUrl();
            if (requestProxyUrl) {
                dispatcher = proxyAgents.create(requestProxyUrl);
            }
        } else if (proxyUrl) {
            dispatcher = proxyAgents.create(proxyUrl);
        }

        if (dispatcher) {
            return fetch(url, { ...options, dispatcher });
        }

        return fetch(url, options);
    };
}

module.exports = {
    createFetchFn,
    formatFetchError,
};
