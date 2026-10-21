import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { MongoClient } from 'mongodb';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}

test('built API: isolated database, auth lifecycle and core CRUD', { timeout: 180000 }, async t => {
  // Never read the developer .env or use MONGODB_URI as a fallback.
  const dbName = `tobu_test_${randomUUID().replaceAll('-', '')}`;
  const tempRoot = resolve(tmpdir());
  const scratch = await mkdtemp(join(tempRoot, 'tobu-api-test-'));
  let mongo, api, client;
  let mongoError, apiError;
  let apiOutput = '';
  t.after(async () => {
    try {
      await stop(api);
      if (client) {
        try { await client.db(dbName).dropDatabase(); } finally { await client.close(); }
      }
    } finally {
      await stop(mongo);
      if (dirname(resolve(scratch)) !== tempRoot) throw new Error('Unexpected test scratch path');
      await rm(scratch, { recursive: true, force: true });
    }
  });

  let uri;
  if (process.env.MONGOD_BIN) {
    const port = await freePort();
    mongo = spawn(process.env.MONGOD_BIN, ['--dbpath', scratch, '--port', String(port), '--bind_ip', '127.0.0.1'],
      { stdio: 'ignore', windowsHide: true });
    mongo.on('error', error => { mongoError = error; });
    uri = `mongodb://127.0.0.1:${port}/${dbName}`;
  } else {
    const endpoint = process.env.TEST_MONGODB_URI;
    assert.ok(endpoint, 'Provide TEST_MONGODB_URI for a dedicated test server or MONGOD_BIN for an isolated native instance');
    const parsed = new URL(endpoint);
    assert.equal(parsed.protocol, 'mongodb:');
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Only local test servers are accepted');
    // A new random database is always used, regardless of the URI database name.
    parsed.pathname = `/${dbName}`;
    uri = parsed.toString();
  }

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 1500 });
  let ready = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    if (mongoError) throw mongoError;
    try { await client.connect(); await client.db(dbName).command({ ping: 1 }); ready = true; break; }
    catch { await delay(200); }
  }
  assert.ok(ready, 'Isolated MongoDB did not become ready');

  const env = { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, PORT: String(await freePort()), CORS_ORIGIN: 'http://localhost:4200' };
  for (const kind of ['ACCESS', 'REFRESH']) {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    env[`JWT_${kind}_PRIVATE_KEY_PEM`] = keys.privateKey;
    env[`JWT_${kind}_PUBLIC_KEY_PEM`] = keys.publicKey;
  }
  api = spawn(process.execPath, [join(root, 'dist/src/server.js')], { cwd: scratch, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  api.on('error', error => { apiError = error; });
  api.stdout.on('data', data => { apiOutput += data; });
  api.stderr.on('data', data => { apiOutput += data; });
  const base = `http://127.0.0.1:${env.PORT}`;
  let healthy = false;
  for (let attempt = 0; attempt < 250; attempt++) {
    if (apiError) throw apiError;
    if (api.exitCode !== null) throw new Error(`API exited: ${apiOutput}`);
    try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) })).ok) { healthy = true; break; } }
    catch { /* wait for bootstrap */ }
    await delay(200);
  }
  assert.ok(healthy, `API not ready: ${apiOutput}`);
  async function request(method, path, body, token, cookie) {
    return fetch(base + path, { method, signal: AbortSignal.timeout(10000), headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  const credentials = { email: 'phase1@example.test', password: 'Phase1-test-password', name: 'Phase One' };
  let token, refresh, userId, accountId;

  await t.test('artifact serves OpenAPI and discovers compiled migrations from another cwd', async () => {
    const spec = await (await request('GET', '/openapi.json')).json();
    assert.ok(Object.keys(spec.paths).length > 0);
    const migrations = await request('GET', '/health/migrations');
    assert.equal(migrations.status, 200);
    const { pending } = await migrations.json();
    assert.equal(pending.length, 5);
    assert.ok(pending.every(name => name.endsWith('.js')));
  });
  await t.test('protected resources reject missing and invalid tokens', async () => {
    assert.equal((await request('GET', '/api/accounts')).status, 401);
    assert.equal((await request('GET', '/api/accounts', undefined, 'invalid')).status, 401);
  });
  await t.test('register, duplicate and login validation', async () => {
    const response = await request('POST', '/api/auth/register', credentials);
    assert.equal(response.status, 201);
    const auth = await response.json(); token = auth.accessToken; userId = auth.user.id;
    assert.deepEqual(auth.user.roles, ['user']);
    assert.equal((await request('POST', '/api/auth/register', credentials)).status, 409);
    assert.equal((await request('POST', '/api/auth/login', { ...credentials, password: 'wrong-password' })).status, 401);
    const login = await request('POST', '/api/auth/login', credentials);
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
    refresh = login.headers.getSetCookie()[0].split(';')[0];
    token = (await login.json()).accessToken;
  });
  await t.test('member and account create/read/update', async () => {
    const memberResponse = await request('POST', '/api/members', { name: 'Phase One', email: credentials.email, userId }, token);
    assert.equal(memberResponse.status, 201);
    const member = await memberResponse.json();
    const accountResponse = await request('POST', '/api/accounts', { name: 'Integration account', members: [{ memberId: member._id, role: 'owner' }] }, token);
    assert.equal(accountResponse.status, 201);
    accountId = (await accountResponse.json())._id;
    assert.equal((await request('GET', `/api/accounts/${accountId}`, undefined, token)).status, 200);
    const patch = await request('PATCH', `/api/accounts/${accountId}`, { name: 'Updated account' }, token);
    assert.equal(patch.status, 200);
    assert.equal((await patch.json()).name, 'Updated account');
  });
  await t.test('transaction CRUD and validation through real HTTP and MongoDB', async () => {
    const dto = { accountId, title: 'Integration expense', type: 'expense', amountMinor: 1234, month: '2026-04', isFromSharedAccount: true };
    assert.equal((await request('POST', '/api/transactions', { ...dto, amountMinor: -1 }, token)).status, 400);
    assert.equal((await request('POST', '/api/transactions', { ...dto, status: 'booked' }, token)).status, 400);
    const createdResponse = await request('POST', '/api/transactions', dto, token);
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(created.month, '2026-04-01T00:00:00.000Z');
    const updated = await request('PATCH', `/api/transactions/${created._id}`, { title: 'Updated expense', amountMinor: 2500 }, token);
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).amountMinor, 2500);
    const list = await (await request('GET', `/api/transactions?accountId=${accountId}&month=2026-04`, undefined, token)).json();
    assert.equal(list.total, 1); assert.equal(list.items[0].title, 'Updated expense');
    assert.equal((await request('DELETE', `/api/transactions/${created._id}`, undefined, token)).status, 204);
    assert.equal((await request('GET', `/api/transactions/${created._id}`, undefined, token)).status, 404);
  });
  await t.test('summary, overview, month and planning endpoints remain reachable', async () => {
    for (const path of ['/api/accounts/summary', `/api/accounts/${accountId}/overview`,
      `/api/accounts/${accountId}/month-view?month=2026-04`, `/api/accounts/${accountId}/planning?month=2026-04`]) {
      const response = await request('GET', path, undefined, token);
      assert.equal(response.status, 200, `${path}: ${await response.text()}`);
    }
  });
  await t.test('refresh rotates the cookie and logout invalidates it', async () => {
    const response = await request('POST', '/api/auth/refresh', undefined, undefined, refresh);
    assert.equal(response.status, 200);
    const rotated = response.headers.getSetCookie()[0].split(';')[0];
    assert.notEqual(rotated, refresh);
    const logout = await request('POST', '/api/auth/logout', undefined, undefined, rotated);
    assert.equal(logout.status, 204);
    assert.equal((await request('POST', '/api/auth/refresh', undefined, undefined, rotated)).status, 401);
  });
  await t.test('inactive users cannot log in', async () => {
    await client.db(dbName).collection('users').updateOne({ emailNormalized: credentials.email }, { $set: { isActive: false } });
    assert.equal((await request('POST', '/api/auth/login', credentials)).status, 401);
  });
});
