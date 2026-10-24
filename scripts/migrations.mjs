import { resolve } from 'node:path';
import { apiRoot, loadConfig, apiEnvironment } from './lib/config.mjs';
import { assertPortFree, run } from './lib/processes.mjs';

// No Docker start, baseline adoption, seeds or automatic fallbacks in this administrative command.
try {
    if (process.env.NODE_ENV === 'production') throw new Error('Use the compiled migration CLI with deployment-provided configuration in production');
    const command = process.argv[2] ?? 'status';
    const config = loadConfig();
    if (['up', 'down', 'recover'].includes(command)) {
        await assertPortFree(config.apiPort);
        await assertPortFree(config.webPort);
    }
    // Setup/build prepares contracts. Status/plan must not rewrite files watched by a live API.
    await run(process.execPath, [resolve(apiRoot, 'scripts/migration-files.mjs'), '--check']);
    await run(process.execPath, [resolve(apiRoot, 'scripts/build.mjs')]);
    await run(process.execPath, [resolve(apiRoot, 'dist/src/database/migration-cli.js'), command, ...process.argv.slice(3)], { env: apiEnvironment(config) });
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
