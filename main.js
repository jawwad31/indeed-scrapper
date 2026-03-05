const { runActor } = require('./src/actor');

async function main() {
    const { Actor } = await import('apify');

    await Actor.main(async () => {
        await runActor(Actor);
    });
}

main().catch((error) => {
    console.error('Actor failed:', error);
    process.exitCode = 1;
});
