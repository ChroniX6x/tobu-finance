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
import { assertResponse, findEndpoint } from '@tobu/contracts/endpoints';

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

  const init = spawn(process.execPath, [join(root, 'dist/src/database/cli.js'), 'init'], {
    cwd: scratch, env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri }, windowsHide: true, stdio: 'inherit',
  });
  assert.equal((await once(init, 'exit'))[0], 0, 'Baseline initialization');

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
    const response = await fetch(base + path, { method, signal: AbortSignal.timeout(10000), headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const pathname = new URL(base + path).pathname;
    if (findEndpoint(method, pathname) && response.headers.get('content-type')?.includes('application/json')) {
      assertResponse(method, pathname, response.status, await response.clone().json());
    }
    return response;
  }
  const credentials = { email: 'phase1@example.test', password: 'Phase1-test-password', name: 'Phase One' };
  let token, refresh, userId, accountId;

  await t.test('artifact serves OpenAPI and reports baseline without archived migrations from another cwd', async () => {
    const spec = await (await request('GET', '/openapi.json')).json();
    assert.ok(Object.keys(spec.paths).length > 0);
    const migrations = await request('GET', '/health/migrations');
    assert.equal(migrations.status, 200);
    const { pending } = await migrations.json();
    assert.equal(pending.length, 0);
    assert.equal((await request('GET', '/ready')).status, 200);
    await client.db(dbName).collection('_tobu_schema').updateOne({ _id: 'baseline' }, { $set: { status: 'initializing' } });
    try {
      assert.equal((await request('GET', '/health')).status, 200, 'Liveness stays independent of schema readiness');
      assert.equal((await request('GET', '/ready')).status, 503, 'Incomplete baseline must not be ready');
    } finally {
      await client.db(dbName).collection('_tobu_schema').updateOne({ _id: 'baseline' }, { $set: { status: 'ready' } });
    }
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
    refresh = login.headers.getSetCookie().find(value => /^rt=[^;]/.test(value)).split(';')[0];
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
  await t.test('split inheritance, sums, merged patch rules and query normalization', async () => {
    const members = await (await request('GET','/api/members',undefined,token)).json();
    const body = {accountId,title:'Private parent',type:'expense',amountMinor:1000,month:'2026-04',isFromSharedAccount:false,paidByMemberId:members[0]._id};
    const parent = await (await request('POST','/api/transactions',body,token)).json();
    const childResponse = await request('POST','/api/transactions',{...body,title:'Split',type:'income',amountMinor:400,isFromSharedAccount:true,paidByMemberId:null,parentTransactionId:parent._id},token);
    assert.equal(childResponse.status,201);
    const child=await childResponse.json();
    assert.equal(child.type,'expense');assert.equal(child.isFromSharedAccount,false);assert.equal(child.paidByMemberId,members[0]._id);
    assert.equal((await request('POST','/api/transactions',{...body,parentTransactionId:parent._id,amountMinor:601},token)).status,422);
    assert.equal((await request('PATCH',`/api/transactions/${parent._id}`,{amountMinor:399},token)).status,422);
    assert.equal((await request('PATCH',`/api/transactions/${child._id}`,{type:'income'},token)).status,422);
    assert.equal((await request('PATCH',`/api/transactions/${parent._id}`,{status:'booked'},token)).status,422);
    assert.equal((await request('GET',`/api/transactions?accountId=${accountId}&categoryIds[]=bad`,undefined,token)).status,400);
    const listed=await (await request('GET',`/api/transactions?accountId=${accountId}&parentTransactionId=${parent._id}&sort=amountAsc&pageSize=1`,undefined,token)).json();
    assert.equal(listed.items[0]._id,child._id);assert.equal(listed.total,1);
    assert.equal((await request('DELETE',`/api/transactions/${parent._id}`,undefined,token)).status,204);
    assert.equal(await client.db(dbName).collection('transactions').countDocuments(),0);
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
    const rotated = response.headers.getSetCookie().find(value => /^rt=[^;]/.test(value)).split(';')[0];
    assert.notEqual(rotated, refresh);
    const logout = await request('POST', '/api/auth/logout', undefined, undefined, rotated);
    assert.equal(logout.status, 204);
    assert.equal((await request('POST', '/api/auth/refresh', undefined, undefined, rotated)).status, 401);
  });
  await t.test('demo read models expose the documented independent contribution totals', async () => {
    const seed = spawn(process.execPath, [join(root, 'dist/src/database/cli.js'), 'seed'], {
      cwd: scratch, env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, SEED_MONTH: '2026-04' }, windowsHide: true, stdio: 'inherit',
    });
    assert.equal((await once(seed, 'exit'))[0], 0);
    const login = await request('POST', '/api/auth/login', { email: 'alice@demo.tobu.test', password: 'Tobu-Demo-2026!' });
    assert.equal(login.status, 200);
    const demoToken = (await login.json()).accessToken;
    const household = await client.db(dbName).collection('accounts').findOne({ name: /^03/ });
    for (const endpoint of ['overview', 'planning', 'month-view', 'master-data']) {
      const response = await request('GET', `/api/accounts/${household._id}/${endpoint}?month=2026-04`, undefined, demoToken);
      assert.equal(response.status, 200, `${endpoint}: ${await response.text()}`);
    }
    const view = await (await request('GET', `/api/accounts/${household._id}/month-view?month=2026-04`, undefined, demoToken)).json();
    assert.equal(view.kpis.totalDueMinor, 30000);
    assert.equal(view.kpis.totalPaidMinor, 25000);
    assert.equal(view.kpis.carryoverTotalMinor, 2500);
    assert.equal(view.members.find(member => member.name === 'Demo alice').openAmountMinor, 0);
    assert.equal(view.members.find(member => member.name === 'Demo bob').openAmountMinor, 5000);
    const next = await (await request('GET', `/api/accounts/${household._id}/month-view?month=2026-05`, undefined, demoToken)).json();
    assert.equal(next.kpis.totalDueMinor, 42500, 'The additional contribution starts in May, not April');
    for (const [month, expectedBlocks] of [['2026-04', 1], ['2026-05', 2]]) {
      const planning = await (await request('GET', `/api/accounts/${household._id}/planning?month=${month}`, undefined, demoToken)).json();
      assert.equal(planning.overview.activeContributionBlockCount, expectedBlocks, 'Planning uses the same exclusive month boundary');
    }
    for (const [prefix, expected] of [['04', [3334, 3333, 3333]], ['05', [6001, 4000]]]) {
      const account = await client.db(dbName).collection('accounts').findOne({ name: new RegExp(`^${prefix}`) });
      const response = await request('GET', `/api/accounts/${account._id}/month-view?month=2026-04`, undefined, demoToken);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).members.map(member => member.monthlyDueMinor), expected);
    }
    for (const resource of ['accounts','members','categories','member-incomes','category-budgets','contribution-rules','account-balances','carryovers','recurrences']) {
      const response=await request('GET',`/api/${resource}?accountId=${household._id}`,undefined,demoToken);
      assert.equal(response.status,200,`${resource}: ${await response.text()}`);
    }
    const expanded=await request('GET',`/api/accounts/${household._id}/expanded?include=members,categories,transactions,memberIncomes,carryovers,accountBalances,categoryBudgets,recurrences`,undefined,demoToken);
    assert.equal(expanded.status,200,await expanded.text());
  });
  await t.test('inactive users cannot log in', async () => {
    await client.db(dbName).collection('users').updateOne({ emailNormalized: credentials.email }, { $set: { isActive: false } });
    assert.equal((await request('POST', '/api/auth/login', credentials)).status, 401);
  });
});
