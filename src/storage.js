const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = process.cwd();
const LOCAL_KV_DIR = path.join(ROOT, 'apify_storage', 'key_value_stores', 'default');
const LOCAL_DATASET_DIR = path.join(ROOT, 'apify_storage', 'datasets', 'default');

async function createStorage() {
    const apifyStorage = await tryCreateApifyStorage();
    if (apifyStorage) return apifyStorage;
    return createLocalStorage();
}

async function tryCreateApifyStorage() {
    try {
        // Optional dependency. Actor still runs locally without the package.
        const { Actor } = require('apify');
        await Actor.init();
        return {
            kind: 'apify',
            getInput: () => Actor.getInput(),
            pushData: (item) => Actor.pushData(item),
            setValue: (key, value) => Actor.setValue(key, value),
            exit: () => Actor.exit(),
        };
    } catch {
        return null;
    }
}

async function createLocalStorage() {
    await fs.mkdir(LOCAL_KV_DIR, { recursive: true });
    await fs.mkdir(LOCAL_DATASET_DIR, { recursive: true });

    const existing = await fs.readdir(LOCAL_DATASET_DIR).catch(() => []);
    let counter = existing.filter((file) => /^\d+\.json$/.test(file)).length;

    return {
        kind: 'local',
        async getInput() {
            const inputPath = path.join(LOCAL_KV_DIR, 'INPUT.json');
            const raw = await fs.readFile(inputPath, 'utf8');
            return JSON.parse(raw);
        },
        async pushData(payload) {
            const items = Array.isArray(payload) ? payload : [payload];
            for (const item of items) {
                counter += 1;
                const fileName = `${String(counter).padStart(9, '0')}.json`;
                const filePath = path.join(LOCAL_DATASET_DIR, fileName);
                await fs.writeFile(filePath, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
            }
        },
        async setValue(key, value) {
            const filePath = path.join(LOCAL_KV_DIR, `${key}.json`);
            await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
        },
        async exit() {
            return undefined;
        },
    };
}

module.exports = {
    createStorage,
};