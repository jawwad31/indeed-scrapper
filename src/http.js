function createFetchFn(proxyUrl) {
    if (!proxyUrl) {
        return fetch;
    }

    let ProxyAgent;
    try {
        ({ ProxyAgent } = require('undici'));
    } catch (error) {
        throw new Error(`Proxy requested but undici ProxyAgent is unavailable: ${String(error.message || error)}`);
    }

    const dispatcher = new ProxyAgent(proxyUrl);
    return (url, options = {}) => fetch(url, { ...options, dispatcher });
}

module.exports = {
    createFetchFn,
};