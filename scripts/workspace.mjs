import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, apiRoot, webRoot, apiRequire, webRequire, initializeConfig, loadConfig, apiEnvironment } from './lib/config.mjs';
import { databaseUp, databaseDown, pingDatabase, requireDocker } from './lib/docker.mjs';
import { run, start, stop, assertPortFree, waitHttp, ownedChildren } from './lib/processes.mjs';

const command = process.argv[2];
const children = [];
let closing = false;
let shutdownPromise;
function shutdown() {
    closing = true;
    return (shutdownPromise ??= Promise.all([...ownedChildren].map(stop)));
}
process.on('SIGINT', () => {
    void shutdown();
});
process.on('SIGTERM', () => {
    void shutdown();
});
// A parent verification process can request the same shutdown on Windows,
// where Node cannot send a console Ctrl+C event to another process.
process.on('message', (message) => {
    if (message === 'shutdown') void shutdown();
});
const tsx = pathToFileURL(apiRequire.resolve('tsx/esm')).href;
export async function dbCommand(command, config, extra = {}) {
    await run(process.execPath, ['--import', tsx, resolve(apiRoot, 'src/database/cli.ts'), command], {
        cwd: apiRoot,
        env: { ...apiEnvironment(config), TOBU_MIGRATION_BACKUP_DIR: process.env.TOBU_MIGRATION_BACKUP_DIR ?? resolve(root, 'backups/migrations'), TOBU_MIGRATION_BACKUP_MODE: config.mode === 'docker' ? 'docker-local' : 'native', ...extra }
    });
}
try {
    if (!['setup', 'init', 'down', 'dev', 'debug', 'init-db', 'seed', 'migrate', 'reset'].includes(command)) throw new Error('Unknown workspace command');
    if (process.versions.node !== '24.13.1') throw new Error('Use the pinned Node 24.13.1 version (.node-version/.nvmrc).');
    if (process.env.NODE_ENV === 'production') throw new Error('Development orchestration is disabled in NODE_ENV=production.');
    if (['setup', 'init'].includes(command)) initializeConfig();
    const config = loadConfig();
    if (command === 'down') await databaseDown(config);
    else {
        if (['setup', 'init'].includes(command)) {
            await run(process.execPath, ['--import', tsx, resolve(apiRoot, 'scripts/ensure-env.ts')], { cwd: apiRoot });
        }
        if (command !== 'init') {
            // Reject a duplicate start before rewriting shared output watched by the live API/Web.
            if (['dev', 'debug'].includes(command)) {
                await assertPortFree(config.apiPort);
                await assertPortFree(config.webPort);
            }
            if (command === 'debug') await assertPortFree(9229);
            await run(process.execPath, [apiRequire.resolve('typescript/bin/tsc'), '-p', resolve(root, 'packages/contracts/tsconfig.json')], { cwd: root });
            if (closing) throw new Error('Startup interrupted');
            // Docker is also a prerequisite in external development mode (isolated tests).
            if (command === 'setup') await requireDocker();
            await databaseUp(config);
            if (closing) throw new Error('Startup interrupted');
            if (['setup', 'init-db', 'seed', 'migrate', 'reset'].includes(command)) {
                const confirm = process.argv.find((a) => a.startsWith('--confirm='))?.slice('--confirm='.length);
                if (command === 'reset') {
                    if (config.mode !== 'docker' || config.dbName !== 'tobu_finance_dev' || confirm !== config.dbName) throw new Error('Reset is only allowed for Docker tobu_finance_dev with --confirm=tobu_finance_dev.');
                    console.log(`Explicit reset of ${config.dbName} in Compose project ${config.project}`);
                }
                await dbCommand(command === 'init-db' ? 'init' : command, config, confirm ? { TOBU_RESET_CONFIRM: confirm } : {});
            } else if (['dev', 'debug'].includes(command)) {
                await dbCommand('check', config);
                children.push(start(process.execPath, [apiRequire.resolve('typescript/bin/tsc'), '-p', resolve(root, 'packages/contracts/tsconfig.json'), '--watch', '--preserveWatchOutput'], { cwd: root, detached: process.platform !== 'win32' }));
                if (closing) throw new Error('Startup interrupted');
                const api = start(process.execPath, [...(command === 'debug' ? ['--inspect=127.0.0.1:9229'] : []), '--watch', '--import', tsx, resolve(apiRoot, 'src/server.ts')], {
                    cwd: apiRoot,
                    env: apiEnvironment(config),
                    detached: process.platform !== 'win32'
                });
                children.push(api);
                await waitHttp(`http://127.0.0.1:${config.apiPort}/ready`, api);
                if (closing) throw new Error('Startup interrupted');
                const web = start(process.execPath, [webRequire.resolve('@angular/cli/bin/ng.js'), 'serve', '--host', '127.0.0.1', '--port', String(config.webPort)], {
                    cwd: webRoot,
                    env: { ...process.env, TOBU_API_TARGET: `http://127.0.0.1:${config.apiPort}` },
                    detached: process.platform !== 'win32'
                });
                children.push(web);
                await waitHttp(`http://127.0.0.1:${config.webPort}`, web, 180000);
                console.log(`ToBu ready: http://localhost:${config.webPort} | API http://127.0.0.1:${config.apiPort} | DB ${config.dbName} (${config.mode})`);
                // Also detect DB/API failure when a watcher remains alive after its child crashed.
                let checking = false;
                const monitor = setInterval(async () => {
                    if (checking || closing) return;
                    checking = true;
                    try {
                        await pingDatabase(config.uri);
                        await waitHttp(`http://127.0.0.1:${config.apiPort}/ready`, api, 10000);
                    } catch (error) {
                        console.error(error.message);
                        process.exitCode = 1;
                        await shutdown();
                    } finally {
                        checking = false;
                    }
                }, 5000);
                try {
                    const result = await Promise.race(children.map((c) => c.done));
                    if (!closing) {
                        process.exitCode = result.code || 1;
                        console.error('A service exited; stopping the complete stack.');
                    }
                } finally {
                    clearInterval(monitor);
                }
            } else throw new Error('Unknown workspace command');
        }
    }
} catch (error) {
    if (!closing) {
        console.error(error.message);
        process.exitCode = 1;
    }
} finally {
    await shutdown();
    if (process.connected) process.disconnect();
}
