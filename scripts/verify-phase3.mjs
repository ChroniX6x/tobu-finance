import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { root, apiRoot, apiRequire } from './lib/config.mjs';
import { requireDocker, pingDatabase } from './lib/docker.mjs';
import { start, stop, run, capture, waitHttp, assertPortFree } from './lib/processes.mjs';

const { MongoClient } = apiRequire('mongodb');
async function freePort() {
    const server = createServer().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    await new Promise((r) => server.close(r));
    return port;
}
const project = `tobu-gate3-${randomUUID().replaceAll('-', '')}`;
const ports = new Set();
while (ports.size < 3) ports.add(await freePort());
const [dbPort, apiPort, webPort] = [...ports];
const env = { ...process.env, DB_MODE: 'docker', DB_PORT: String(dbPort), API_PORT: String(apiPort), WEB_PORT: String(webPort), COMPOSE_PROJECT: project, DEV_DB_NAME: 'tobu_finance_dev', SEED_MONTH: '2026-04', NODE_ENV: 'development' };
const uri = `mongodb://127.0.0.1:${dbPort}/tobu_finance_dev`;
const workspace = resolve(root, 'scripts/workspace.mjs');
const command = (name, extra = {}) => capture(process.execPath, [workspace, name], { cwd: root, env: { ...env, ...extra } });
let dev,
    client,
    databaseCreated = false;
let aborted = false;
process.on('SIGINT', () => {
    aborted = true;
    void stop(dev);
});
process.on('SIGTERM', () => {
    aborted = true;
    void stop(dev);
});
const checkAbort = () => {
    if (aborted) throw new Error('Gate 3 interrupted');
};
async function snapshot() {
    const db = client.db();
    const result = {};
    for (const collection of await db.listCollections({}, { nameOnly: true }).toArray()) {
        result[collection.name] = await db.collection(collection.name).find().sort({ _id: 1 }).toArray();
    }
    return result;
}
async function startStack() {
    checkAbort();
    dev = start(process.execPath, [workspace, 'dev'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], detached: process.platform !== 'win32' });
    dev.stdout.on('data', (chunk) => process.stdout.write(chunk));
    dev.stderr.on('data', (chunk) => process.stderr.write(chunk));
    await waitHttp(`http://127.0.0.1:${apiPort}/ready`, dev);
    await waitHttp(`http://127.0.0.1:${webPort}`, dev, 180000);
}
async function stopStack() {
    if (!dev) return;
    if (dev.connected) dev.send('shutdown');
    let timer;
    try {
        await Promise.race([
            dev.done,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Stack shutdown timed out')), 20000);
            })
        ]);
    } finally {
        clearTimeout(timer);
        await stop(dev);
        dev = undefined;
    }
    await assertPortFree(apiPort);
    await assertPortFree(webPort);
}
try {
    await requireDocker();
    const runtimeOnly = process.argv.includes('--runtime-only');
    if (!process.env.npm_execpath) throw new Error('Run npm run verify:phase3 from the repository root');
    for (const script of runtimeOnly ? [] : ['check:workspace', 'typecheck', 'build', 'test:tooling', 'test:api', 'test:web', 'e2e']) {
        checkAbort();
        console.log(`Gate 3: ${script}`);
        await run(process.execPath, [process.env.npm_execpath, 'run', script], { cwd: root });
    }
    checkAbort();
    databaseCreated = true; // Own UUID project only; cleanup also handles interrupted setup.
    console.log(await command('setup'));
    const rootEnv = await readFile(resolve(root, '.env'), 'utf8');
    const apiEnv = await readFile(resolve(apiRoot, '.env'), 'utf8');
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    await client
        .db()
        .collection('_gate_manual')
        .insertOne({ text: 'Manuelle Testdaten bleiben erhalten', createdAt: new Date('2026-04-02') });
    const baseline = await snapshot();
    console.log(await command('setup'));
    assert.equal(await readFile(resolve(root, '.env'), 'utf8'), rootEnv);
    assert.equal(await readFile(resolve(apiRoot, '.env'), 'utf8'), apiEnv);
    assert.deepEqual(await snapshot(), baseline, 'Repeated setup must preserve all data');
    await startStack();
    await assert.rejects(() => command('dev'), /occupied/);
    const response = await fetch(`http://127.0.0.1:${webPort}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'alice@demo.tobu.test', password: 'Tobu-Demo-2026!' }) });
    assert.equal(response.status, 200, 'Same-origin login through the development proxy');
    await stopStack();
    const afterLogin = await snapshot();
    console.log(await command('down'));
    await startStack();
    assert.deepEqual(await snapshot(), afterLogin, 'Container restart must preserve development data');
    await stopStack();
    await command('down', { DB_MODE: 'external', MONGODB_URI: uri });
    await pingDatabase(uri); // External stop must not stop even our known test server.
    await assert.rejects(() => command('dev', { DB_MODE: 'external', MONGODB_URI: `mongodb://127.0.0.1:${apiPort}/tobu_unreachable` }), /ECONNREFUSED|connect|Server selection/i);
    await assert.rejects(() => command('dev', { PATH: '', Path: '' }), /Docker engine\/Compose is unavailable/);
    await assert.rejects(() => command('reset'), /explicit|only allowed/i);
    for (const script of runtimeOnly ? [] : ['test:integration', 'e2e:real']) {
        checkAbort();
        await run(process.execPath, [process.env.npm_execpath, 'run', script], { cwd: root });
        assert.deepEqual(await snapshot(), afterLogin, `${script} must not change development data`);
    }
    console.log(runtimeOnly ? 'LIFECYCLE VERIFICATION PASSED' : 'GATE 3 AUTOMATED VERIFICATION PASSED');
    console.log('Still confirm manually: terminal Ctrl+C, API/Web hot reload, VS Code debug and persistence of a UI-created transaction. See docs/migration/phase-3-verification.md.');
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await stop(dev);
    await client?.close();
    if (databaseCreated) {
        if (!/^tobu-gate3-[a-f0-9]{32}$/.test(project)) throw new Error('Unsafe cleanup project');
        await run('docker', ['compose', '--project-name', project, '--file', resolve(root, 'infra/compose.yaml'), 'down', '--volumes'], { env });
    }
}
