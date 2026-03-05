function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapLimit(items, limit, mapper) {
    const results = new Array(items.length);
    let index = 0;

    async function worker() {
        while (true) {
            const current = index;
            index += 1;
            if (current >= items.length) return;
            results[current] = await mapper(items[current], current);
        }
    }

    const workers = [];
    const safeLimit = Math.max(1, Math.min(limit, items.length || 1));
    for (let i = 0; i < safeLimit; i += 1) {
        workers.push(worker());
    }

    await Promise.all(workers);
    return results;
}

function pickDefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

module.exports = {
    clamp,
    mapLimit,
    pickDefined,
    sleep,
};