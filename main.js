const { runActor } = require('./src/actor');

runActor().catch((error) => {
    console.error('Actor failed:', error);
    process.exitCode = 1;
});