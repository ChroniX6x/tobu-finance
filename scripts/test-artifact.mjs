import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, cp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { root } from './lib/config.mjs';
import { temporaryDatabase } from './lib/docker.mjs';
import { run, start, stop, waitHttp, ownedChildren, capture } from './lib/processes.mjs';

async function freePort() {
    const s = createServer().listen(0, '127.0.0.1');
    await once(s, 'listening');
    const p = s.address().port;
    await new Promise((r) => s.close(r));
    return p;
}
let scratch, db, server;
async function removeScratch(path) {
    if (dirname(resolve(path)) !== resolve(tmpdir())) throw new Error('Invalid artifact scratch path');
    await rm(path, { recursive: true, force: true });
}
const abort = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
        process.exitCode = signal === 'SIGINT' ? 130 : 143;
        abort.abort();
        void Promise.all([...ownedChildren].map(stop));
    });
try {
    if (!process.env.npm_execpath) throw new Error('Run npm run test:artifact');
    db = await temporaryDatabase(abort.signal);
    abort.signal.throwIfAborted();
    scratch = await mkdtemp(join(tmpdir(), 'tobu-release-'));
    await cp(resolve(root, 'dist/release'), scratch, { recursive: true, filter: (path) => basename(path) !== 'node_modules' });
    const env = { ...process.env, NODE_ENV: 'production', MONGODB_URI: db.uri, PORT: String(await freePort()), WEB_PORT: String(await freePort()) };
    while (env.PORT === env.WEB_PORT) env.WEB_PORT = String(await freePort());
    delete env.NODE_PATH;
    delete env.NODE_OPTIONS;
    await run(process.execPath, [process.env.npm_execpath, 'ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: scratch, env });
    abort.signal.throwIfAborted();
    for (const file of ['apps/api/src', 'apps/web/src', 'node_modules/tsx', 'node_modules/typescript', 'apps/api/dist/src/migrations']) {
        await assert.rejects(access(resolve(scratch, file)), `${file} must not be in the artifact`);
    }
    for (const kind of ['ACCESS', 'REFRESH']) {
        const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
        env[`JWT_${kind}_PRIVATE_KEY_PEM`] = keys.privateKey;
        env[`JWT_${kind}_PUBLIC_KEY_PEM`] = keys.publicKey;
    }
    // Baseline/seed CLI is an explicit test setup step, never a production start side effect.
    await run(process.execPath, ['apps/api/dist/src/database/cli.js', 'init'], { cwd: scratch, env: { ...env, NODE_ENV: 'test' } });
    const plan = JSON.parse(await capture(process.execPath, ['apps/api/dist/src/database/migration-cli.js', 'plan'], { cwd: scratch, env }));
    assert.equal(plan.target.environment, 'production');
    assert.equal(plan.target.database, new URL(db.uri).pathname.slice(1));
    assert.deepEqual(plan.migrations, []);
    await run(process.execPath, ['apps/api/dist/src/database/migration-cli.js', 'up', `--confirm=${plan.confirmation}`, `--writers-stopped=${plan.target.database}`], { cwd: scratch, env });
    abort.signal.throwIfAborted();
    server = start(process.execPath, ['scripts/serve-artifact.mjs'], { cwd: scratch, env, detached: process.platform !== 'win32' });
    const base = `http://127.0.0.1:${env.WEB_PORT}`;
    await waitHttp(base + '/ready', server);
    for (const path of ['/', '/accounts', '/health', '/ready', '/docs/', '/openapi.json']) {
        const response = await fetch(base + path);
        assert.equal(response.status, 200, path);
        if (path === '/accounts') assert.match(await response.text(), /<tbf-root/);
        if (path === '/openapi.json') assert.equal((await response.json()).openapi, '3.1.0');
    }
    const registration = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'artifact@example.test', password: 'Artifact-test-2026!', name: 'Artifact' }) });
    assert.equal(registration.status, 201);
    const auth = await registration.json();
    const response = await fetch(base + '/api/accounts', { headers: { authorization: `Bearer ${auth.accessToken}` } });
    assert.equal(response.status, 200);
    await stop(server);
    server = undefined;
    await assert.rejects(fetch(base + '/health', { signal: AbortSignal.timeout(2000) }), 'Proxy must stop');
    await assert.rejects(fetch(`http://127.0.0.1:${env.PORT}/health`, { signal: AbortSignal.timeout(2000) }), 'API must stop');
    console.log('ARTIFACT VERIFICATION PASSED: isolated production install, compiled API, proxy, auth, OpenAPI, baseline and shutdown');
} finally {
    await stop(server);
    try {
        if (db) await db.stop();
    } finally {
        if (scratch) await removeScratch(scratch);
    }
}
