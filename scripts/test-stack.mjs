import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { root, apiRoot, webRoot, webRequire } from './lib/config.mjs';
import { temporaryDatabase } from './lib/docker.mjs';
import { run, start, stop, waitHttp, ownedChildren } from './lib/processes.mjs';

async function freePort() { const s = createServer().listen(0, '127.0.0.1'); await once(s, 'listening'); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
let database, scratch, cleanupPromise;
const abort = new AbortController();
async function cleanup() {
  return cleanupPromise ??= (async () => {
    await Promise.all([...ownedChildren].map(stop));
    try { if (database) await database.stop(); }
    finally { if (scratch) { if (dirname(resolve(scratch)) !== resolve(tmpdir())) throw new Error('Invalid scratch path'); await rm(scratch, { recursive: true, force: true }); } }
  })();
}
// Abort startup, stop owned commands, then let the single finally block remove resources.
process.on('SIGINT', () => { process.exitCode = 130; abort.abort(); void Promise.all([...ownedChildren].map(stop)); });
process.on('SIGTERM', () => { process.exitCode = 143; abort.abort(); void Promise.all([...ownedChildren].map(stop)); });
try {
  const mode = process.argv[2];
  if (!['integration', 'browser'].includes(mode)) throw new Error('Use integration or browser');
  database = await temporaryDatabase(abort.signal);
  abort.signal.throwIfAborted();
  const env = { ...process.env, NODE_ENV: 'test', TEST_MONGODB_URI: database.uri, MONGODB_URI: database.uri };
  delete env.MONGOD_BIN; // Tests never inherit a native or developer fallback.
  if (mode === 'integration') {
    await run(process.execPath, ['--test', 'tests/integration/*.test.mjs'], { cwd: apiRoot, env });
  } else {
    scratch = await mkdtemp(join(tmpdir(), 'tobu-e2e-'));
    env.PORT = String(await freePort());
    do { env.WEB_PORT = String(await freePort()); } while (env.WEB_PORT === env.PORT);
    env.HOST = '127.0.0.1'; env.CORS_ORIGIN = `http://localhost:${env.WEB_PORT}`;
    for (const kind of ['ACCESS', 'REFRESH']) {
      const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
      env[`JWT_${kind}_PRIVATE_KEY_PEM`] = keys.privateKey; env[`JWT_${kind}_PUBLIC_KEY_PEM`] = keys.publicKey;
    }
    await run(process.execPath, [resolve(apiRoot, 'dist/src/database/cli.js'), 'init'], { cwd: scratch, env });
    abort.signal.throwIfAborted();
    const api = start(process.execPath, [resolve(apiRoot, 'dist/src/server.js')], { cwd: scratch, env, detached: process.platform !== 'win32' });
    await waitHttp(`http://127.0.0.1:${env.PORT}/ready`, api);
    abort.signal.throwIfAborted();
    env.E2E_EMAIL = 'integration@example.test'; env.E2E_PASSWORD = 'Isolated-test-password';
    env.TOBU_API_TARGET = `http://127.0.0.1:${env.PORT}`;
    const response = await fetch(`${env.TOBU_API_TARGET}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD, name: 'Integration' }) });
    if (response.status !== 201) throw new Error('Isolated test registration failed');
    abort.signal.throwIfAborted();
    await run(process.execPath, [webRequire.resolve('@playwright/test/cli'), 'test', '--project=chromium-real-api', '--workers=1'], { cwd: webRoot, env, detached: process.platform !== 'win32' });
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await cleanup(); }
