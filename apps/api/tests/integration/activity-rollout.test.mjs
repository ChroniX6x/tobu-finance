import { temporaryDatabase } from '../../../../scripts/lib/docker.mjs';
import { ActivityWriteEventSchema, renderActivityText } from '@tobu/contracts/activity';
import { createServer as createHttpServer } from 'node:http';
import { creationFetch } from '../fixtures/creation-fetch.mjs';
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
import { MongoClient, ObjectId } from 'mongodb';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function freePort() {
    const socket = createServer();
    socket.listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const port = socket.address().port;
    await new Promise((resolve, reject) => socket.close((error) => (error ? reject(error) : resolve())));
    return port;
}
const stop = async (child) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
};

test('E05 real domain rollout, CRUD/status/split/fault/actor/finance', { timeout: 300000 }, async (t) => {
    const isolated = await temporaryDatabase();
    let release = async () => {};
    t.after(async () => {
        try {
            await release();
        } finally {
            await isolated.stop();
        }
    });
    const endpoint = isolated.uri;
    const parsed = new URL(endpoint);
    assert.equal(parsed.protocol, 'mongodb:');
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Only local test servers are accepted');
    const dbName = `tobu_test_${randomUUID().replaceAll('-', '')}`;
    parsed.pathname = `/${dbName}`;
    const uri = parsed.toString();
    const scratch = await mkdtemp(join(resolve(tmpdir()), 'tobu-acl-test-'));
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    let api;
    let apiOutput = '';
    release = async () => {
        try {
            await stop(api);
            await client
                .db(dbName)
                .dropDatabase()
                .catch(() => {});
        } finally {
            await client.close();
        }
        if (dirname(resolve(scratch)) !== resolve(tmpdir())) throw new Error('Unexpected scratch path');
        await rm(scratch, { recursive: true, force: true });
    };
    await client.connect();
    assert.ok((await client.db('admin').command({ hello: 1 })).setName, 'Transactions need a replica set');

    const init = spawn(process.execPath, [join(root, 'dist/src/database/cli.js'), 'init'], {
        cwd: scratch,
        env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, TOBU_MIGRATION_BACKUP_DIR: join(scratch, 'backups'), TOBU_MIGRATION_BACKUP_MODE: 'docker-local' },
        windowsHide: true,
        stdio: 'inherit'
    });
    assert.equal((await once(init, 'exit'))[0], 0, 'Baseline initialization');
    const env = { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, PORT: String(await freePort()), CORS_ORIGIN: 'http://localhost:4200' };
    for (const kind of ['ACCESS', 'REFRESH']) {
        const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
        env[`JWT_${kind}_PRIVATE_KEY_PEM`] = keys.privateKey;
        env[`JWT_${kind}_PUBLIC_KEY_PEM`] = keys.publicKey;
    }
    api = spawn(process.execPath, [join(root, 'dist/src/server.js')], { cwd: scratch, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    api.stdout.on('data', (data) => (apiOutput += data));
    api.stderr.on('data', (data) => (apiOutput += data));
    const base = `http://127.0.0.1:${env.PORT}`;
    for (let attempt = 0; attempt < 250; attempt++) {
        assert.equal(api.exitCode, null, `API exited: ${apiOutput}`);
        try {
            if ((await fetch(`${base}/ready`, { signal: AbortSignal.timeout(500) })).ok) break;
        } catch {
            /* wait */
        }
        await delay(200);
    }

    const call = async (token, method, path, body) => {
        const response = await creationFetch(base + path, {
            method,
            signal: AbortSignal.timeout(15000),
            headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: ['Bearer', token].join(' ') } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const text = await response.text();
        return { status: response.status, text, json: text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : undefined };
    };
    const db = client.db(dbName);
    // Everything except authentication data: any write or event by a rejected request shows up here.
    const snapshot = async () => {
        const out = {};
        for (const { name } of await db.listCollections().toArray()) {
            if (name.startsWith('_tobu') || name === 'users' || name === 'auth_sessions' || name.startsWith('system.')) continue;
            out[name] = JSON.stringify(await db.collection(name).find({}).sort({ _id: 1 }).toArray());
        }
        out.userRevisions = JSON.stringify(
            await db
                .collection('users')
                .find({}, { projection: { _id: 1, __v: 1, isActive: 1 } })
                .sort({ _id: 1 })
                .toArray()
        );
        return out;
    };
    const register = async (name) => {
        const email = `${name}@example.test`;
        const password = `${name}-test-password`;
        const reg = await call(undefined, 'POST', '/api/auth/register', { email, password, name });
        assert.equal(reg.status, 201);
        return { token: reg.json.accessToken, userId: reg.json.user.id, email, password };
    };
    const alice = await register('e05alice');
    const bob = await register('e05bob');
    const outsider = await register('e05outsider');
    const expectCall = async (who, method, path, body, status) => {
        const result = await call(who?.token, method, path, body);
        assert.equal(result.status, status, `${method} ${path}: ${result.text} ${result.status === status ? '' : apiOutput.slice(-5000)}`);
        return result.json;
    };
    const account = await expectCall(alice, 'POST', '/api/accounts', { name: 'E05' }, 201);
    const accountId = account._id;
    const payer = await expectCall(alice, 'POST', '/api/members', { name: 'Unregistered payer' }, 201);
    const bobMember = await expectCall(bob, 'POST', '/api/members', { name: 'Bob', userId: bob.userId }, 201);
    // Explicit isolated membership fixture, not an invitation/production bypass.
    await db.collection('accounts').updateOne({ _id: new ObjectId(accountId) }, { $push: { members: { memberId: new ObjectId(bobMember._id), role: 'member' } } });
    await expectCall(alice, 'POST', `/api/accounts/${accountId}/members`, { memberId: payer._id, role: 'member' }, 200);
    const count = () => db.collection('events').countDocuments({ accountId: new ObjectId(accountId) });
    const mutation = async (method, path, body, codes, status = method === 'POST' ? 201 : method === 'DELETE' ? 204 : 200, who = alice) => {
        const before = await count();
        const priorIds = new Set(
            (
                await db
                    .collection('events')
                    .find({ accountId: new ObjectId(accountId) }, { projection: { _id: 1 } })
                    .toArray()
            ).map((e) => String(e._id))
        );
        const result = await expectCall(who, method, path, body, status);
        assert.equal(await count(), before + codes.length, `${path} exact event count`);
        const rows = await db
            .collection('events')
            .find({ accountId: new ObjectId(accountId) })
            .sort({ date: 1, _id: 1 })
            .toArray();
        for (const row of rows) {
            const event = { ...row, accountId: String(row.accountId) };
            for (const key of ['_id', '__v', 'createdAt', 'updatedAt']) delete event[key];
            ActivityWriteEventSchema.parse(event);
            assert.equal(row.actor.kind, 'user');
            assert.equal(row.trigger.kind, 'user_action');
            assert.ok(row.commandId && row.correlationId);
        }
        const added = rows.filter((row) => !priorIds.has(String(row._id)));
        assert.deepEqual(added.map((e) => e.code).sort(), [...codes].sort());
        for (const event of added) {
            assert.equal(event.actor.userId, who.userId);
            assert.equal(event.createdByMemberId, null);
        }
        if (added.length > 1) assert.equal(new Set(added.map((e) => e.correlationId)).size, 1);
        return result;
    };
    const noop = async (method, path, body) => {
        const before = await snapshot();
        await expectCall(alice, method, path, body, 200);
        assert.deepEqual(await snapshot(), before, `${path} no-op is entirely write-free`);
    };
    await t.test('EIT-18 account owner/settings/member/role events and no-op', async () => {
        await mutation('PATCH', `/api/accounts/${accountId}`, { name: 'Changed' }, ['account.settings.updated']);
        await noop('PATCH', `/api/accounts/${accountId}`, { name: 'Changed' });
        await mutation('POST', `/api/accounts/${accountId}/members`, { memberId: payer._id, role: 'owner' }, ['account.member.roleChanged'], 200);
        const before = await snapshot();
        const selfId = account.members.find((m) => m.role === 'owner').memberId;
        await expectCall(alice, 'POST', `/api/accounts/${accountId}/members`, { memberId: selfId, role: 'member' }, 409);
        assert.deepEqual(await snapshot(), before, 'unlinked nominal owner cannot replace last linked owner');
        await expectCall(bob, 'PATCH', `/api/accounts/${accountId}`, { name: 'Forbidden' }, 403);
        await expectCall(outsider, 'PATCH', `/api/accounts/${accountId}`, { name: 'Forbidden' }, 404);
        assert.deepEqual(await snapshot(), before);
        await mutation('POST', `/api/accounts/${accountId}/members`, { memberId: payer._id, role: 'member' }, ['account.member.roleChanged'], 200);
    });
    let category;
    await t.test('EIT-18 categories including registered member create, custom split, no-op and delete', async () => {
        category = await mutation('POST', '/api/categories', { accountId, name: 'Food' }, ['category.created'], 201, bob);
        await mutation('PATCH', `/api/categories/${category._id}`, { customSplit: [{ memberId: payer._id, split: 100 }] }, ['category.updated']);
        await mutation('PATCH', `/api/categories/${category._id}`, { name: 'Food again' }, ['category.updated']);
        await mutation('PATCH', `/api/categories/${category._id}`, { name: 'Food' }, ['category.updated']);
        await noop('PATCH', `/api/categories/${category._id}`, { customSplit: [{ memberId: payer._id, split: 100 }] });
        const unused = await mutation('POST', '/api/categories', { accountId, name: 'Unused' }, ['category.created']);
        await mutation('DELETE', `/api/categories/${unused._id}`, undefined, ['category.deleted']);
    });
    await t.test('EIT-19 income/budget/contribution CRUD with exact cents and actors', async () => {
        for (const [path, create, patch, codes, collection] of [
            ['/api/member-incomes', { accountId, memberId: payer._id, amountMinor: 10001, fromMonth: '2026-11' }, { amountMinor: 10003 }, ['memberIncome.added', 'memberIncome.updated', 'memberIncome.removed'], 'member_incomes'],
            ['/api/category-budgets', { accountId, categoryId: category._id, amountMinor: 10001, fromMonth: '2026-11' }, { amountMinor: 10003 }, ['categoryBudget.added', 'categoryBudget.updated', 'categoryBudget.removed'], 'category_budgets'],
            [
                '/api/contribution-rules',
                { accountId, type: 'additional', recurring: false, amountMinor: 10001, distribution: { mode: 'perMember', memberId: payer._id }, fromMonth: '2026-11' },
                { amountMinor: 10003 },
                ['contributionRule.added', 'contributionRule.updated', 'contributionRule.removed'],
                'contribution_rules'
            ]
        ]) {
            const doc = await mutation('POST', path, create, [codes[0]]);
            await mutation('PATCH', `${path}/${doc._id}`, patch, [codes[1]]);
            await mutation('PATCH', `${path}/${doc._id}`, { amountMinor: 10005 }, [codes[1]]);
            await mutation('PATCH', `${path}/${doc._id}`, patch, [codes[1]]);
            assert.equal((await db.collection(collection).findOne({ _id: new ObjectId(doc._id) })).amountMinor, 10003);
            assert.equal((await db.collection(collection).findOne({ _id: new ObjectId(doc._id) })).mutationVersion, 3);
            await noop('PATCH', `${path}/${doc._id}`, patch);
            if (collection === 'category_budgets') {
                const rules = await db
                    .collection('contribution_rules')
                    .find({ accountId: new ObjectId(accountId), type: 'base' })
                    .toArray();
                assert.ok(rules.length > 0);
                assert.equal(rules[0].amountMinor, 10003);
            }
            await mutation('DELETE', `${path}/${doc._id}`, undefined, [codes[2]]);
        }
    });
    await t.test('EIT-20 carryover/balance upsert corrections, no-op, deletion and recreation', async () => {
        for (const [path, values, amount, codes, collection] of [
            ['/api/carryovers', { accountId, memberId: payer._id, month: '2026-11', amountMinor: -301, reason: 'never store this reason in events' }, 'amountMinor', ['carryOver.set', 'carryOver.removed'], 'carryovers'],
            ['/api/account-balances', { accountId, month: '2026-11', closingBalanceMinor: 301 }, 'closingBalanceMinor', ['accountBalance.set', 'accountBalance.removed'], 'account_balances']
        ]) {
            let doc = await mutation('PUT', path, values, [codes[0]]);
            await noop('PUT', path, values);
            await mutation('PUT', path, { ...values, [amount]: 10001 }, [codes[0]]);
            await mutation('PUT', path, { ...values, [amount]: 10003 }, [codes[0]]);
            await mutation('PUT', path, { ...values, [amount]: 10001 }, [codes[0]]);
            assert.equal((await db.collection(collection).findOne({ _id: new ObjectId(doc._id) }))[amount], 10001);
            await mutation('DELETE', `${path}/${doc._id}`, undefined, [codes[1]]);
            doc = await mutation('PUT', path, values, [codes[0]]);
            await mutation('DELETE', `${path}/${doc._id}`, undefined, [codes[1]]);
        }
    });
    await t.test('EIT-14?17 real transaction/status/split CRUD, privacy and cent invariants', async () => {
        const body = { accountId, title: 'Parent', type: 'expense', amountMinor: 10001, month: '2026-11', isFromSharedAccount: false, paidByMemberId: payer._id };
        const parent = await mutation('POST', '/api/transactions', body, ['transaction.created']);
        const child = await mutation('POST', '/api/transactions', { ...body, title: 'Child', amountMinor: 3333, parentTransactionId: parent._id }, ['transaction.splitChildCreated']);
        await mutation('PATCH', `/api/transactions/${parent._id}`, { amountMinor: 10003, categoryId: category._id, notes: 'private raw notes', title: 'Edited' }, ['transaction.updated']);
        await mutation('PATCH', `/api/transactions/${parent._id}`, { title: 'Second edit' }, ['transaction.updated']);
        await mutation('PATCH', `/api/transactions/${parent._id}`, { title: 'Edited' }, ['transaction.updated']);
        await noop('PATCH', `/api/transactions/${parent._id}`, { amountMinor: 10003, categoryId: category._id, notes: 'private raw notes', title: 'Edited' });
        await mutation('PATCH', `/api/transactions/${parent._id}`, { status: 'booked', bookDate: '2026-11-07T00:00:00.000Z' }, ['transaction.updated', 'transaction.booked']);
        const storedChild = await db.collection('transactions').findOne({ _id: new ObjectId(child._id) });
        assert.equal(storedChild.status, 'booked');
        assert.equal(storedChild.amountMinor, 3333);
        await mutation('PATCH', `/api/transactions/${child._id}`, { status: 'pending' }, ['transaction.statusChanged']);
        await noop('PATCH', `/api/transactions/${child._id}`, { status: 'pending' });
        await mutation('PATCH', `/api/transactions/${child._id}`, { status: 'booked' }, ['transaction.booked']);
        assert.equal((await db.collection('transactions').findOne({ _id: new ObjectId(parent._id) })).status, 'booked');
        await mutation('PATCH', `/api/transactions/${parent._id}`, { isFromSharedAccount: true, paidByMemberId: null }, ['transaction.updated']);
        const inherited = await db.collection('transactions').findOne({ _id: new ObjectId(child._id) });
        assert.equal(inherited.isFromSharedAccount, true);
        assert.equal(inherited.paidByMemberId, null);
        assert.equal(inherited.amountMinor, 3333);
        assert.equal((await db.collection('transactions').findOne({ _id: new ObjectId(parent._id) })).amountMinor, 10003);
        await mutation('PATCH', `/api/transactions/${parent._id}`, { status: 'pending' }, ['transaction.statusChanged']);
        await mutation('DELETE', `/api/transactions/${child._id}`, undefined, ['transaction.splitChildDeleted']);
        assert.match(renderActivityText({ code: 'transaction.splitChildDeleted', params: {} }), /Split/);
        await mutation('POST', '/api/transactions', { ...body, title: 'Second child', amountMinor: 2222, parentTransactionId: parent._id, bookDate: '2026-11-07T00:00:00.000Z' }, ['transaction.splitChildCreated']);
        await mutation('DELETE', `/api/transactions/${parent._id}`, undefined, ['transaction.deleted']);
        assert.equal(await db.collection('transactions').countDocuments({ accountId: new ObjectId(accountId) }), 0);
        const allEvents = JSON.stringify(await db.collection('events').find({}).toArray());
        assert.ok(!allEvents.includes('private raw notes'));
        assert.ok(!allEvents.includes('never store this reason'));
    });
    await t.test('legacy recurrence CRUD is reachable, whitelisted and atomic; no new recurrence engine', async () => {
        const rec = await mutation('POST', '/api/recurrences', { accountId, title: 'Legacy', type: 'expense', amountMinor: 101, activeFrom: '2026-11' }, ['legacyRecurrence.created']);
        await mutation('PATCH', `/api/recurrences/${rec._id}`, { title: 'Legacy edited' }, ['legacyRecurrence.updated']);
        await mutation('PATCH', `/api/recurrences/${rec._id}`, { title: 'Legacy another edit' }, ['legacyRecurrence.updated']);
        await mutation('PATCH', `/api/recurrences/${rec._id}`, { title: 'Legacy edited' }, ['legacyRecurrence.updated']);
        await noop('PATCH', `/api/recurrences/${rec._id}`, { title: 'Legacy edited' });
        await mutation('DELETE', `/api/recurrences/${rec._id}`, undefined, ['legacyRecurrence.deleted']);
    });
    await t.test('member.updated fanout is atomic and refuses an inaccessible affected account', async () => {
        await mutation('PATCH', `/api/members/${payer._id}`, { name: 'Renamed', email: 'changed@example.test' }, ['member.updated']);
        await noop('PATCH', `/api/members/${payer._id}`, { name: 'Renamed', email: 'changed@example.test' });
        const shared = await expectCall(alice, 'POST', '/api/accounts', { name: 'Authorized fanout', members: [{ memberId: payer._id }] }, 201);
        const prior = await db.collection('events').find({ code: 'member.updated' }).toArray();
        await expectCall(alice, 'PATCH', `/api/members/${payer._id}`, { name: 'Authorized twice' }, 200);
        const ids = new Set(prior.map((event) => String(event._id)));
        const added = (await db.collection('events').find({ code: 'member.updated' }).toArray()).filter((event) => !ids.has(String(event._id)));
        assert.equal(added.length, 2);
        assert.equal(new Set(added.map((event) => event.correlationId)).size, 1);
        assert.deepEqual(added.map((event) => String(event.accountId)).sort(), [accountId, shared._id].sort());
        for (const event of added) {
            assert.equal(event.actor.userId, alice.userId);
            assert.deepEqual(event.params, { memberId: payer._id, changedFields: ['name'] });
        }
        await expectCall(alice, 'DELETE', `/api/accounts/${shared._id}/members/${payer._id}`, undefined, 200);
        const removed = await snapshot();
        await expectCall(alice, 'DELETE', `/api/accounts/${shared._id}/members/${payer._id}`, undefined, 404);
        assert.deepEqual(await snapshot(), removed, 'repeated membership removal is write-free, with explicit missing-member status');
        const foreign = await expectCall(outsider, 'POST', '/api/accounts', { name: 'Foreign' }, 201);
        await db.collection('accounts').updateOne({ _id: new ObjectId(foreign._id) }, { $push: { members: { memberId: new ObjectId(payer._id), role: 'member' } } });
        const before = await snapshot();
        await expectCall(alice, 'PATCH', `/api/members/${payer._id}`, { name: 'Forbidden fanout' }, 404);
        assert.deepEqual(await snapshot(), before);
        await db.collection('accounts').updateOne({ _id: new ObjectId(foreign._id) }, { $pull: { members: { memberId: new ObjectId(payer._id) } } });
    });
    await t.test('foreign legacy split references are rejected without leaking or altering either account', async () => {
        const parent = await expectCall(alice, 'POST', '/api/transactions', { accountId, title: 'Legacy parent guard', type: 'expense', amountMinor: 1000, month: '2026-11', isFromSharedAccount: true }, 201);
        const child = await expectCall(alice, 'POST', '/api/transactions', { accountId, parentTransactionId: parent._id, title: 'Foreign child secret', type: 'expense', amountMinor: 100, month: '2026-11', isFromSharedAccount: true }, 201);
        const foreign = await expectCall(outsider, 'POST', '/api/accounts', { name: 'Legacy foreign split' }, 201);
        await db.collection('transactions').updateOne({ _id: new ObjectId(child._id) }, { $set: { accountId: new ObjectId(foreign._id) } });
        const before = await snapshot();
        const listing = await expectCall(alice, 'GET', `/api/transactions?accountId=${accountId}&month=2026-11`, undefined, 200);
        assert.ok(!JSON.stringify(listing).includes('Foreign child secret'));
        for (const [who, method, path, body] of [
            [alice, 'PATCH', `/api/transactions/${parent._id}`, { amountMinor: 1100 }],
            [alice, 'DELETE', `/api/transactions/${parent._id}`, undefined],
            [outsider, 'PATCH', `/api/transactions/${child._id}`, { amountMinor: 101 }],
            [outsider, 'DELETE', `/api/transactions/${child._id}`, undefined]
        ]) {
            await expectCall(who, method, path, body, 422);
            assert.deepEqual(await snapshot(), before);
        }
        await db.collection('transactions').updateOne({ _id: new ObjectId(child._id) }, { $set: { accountId: new ObjectId(accountId) } });
        await expectCall(alice, 'DELETE', `/api/transactions/${parent._id}`, undefined, 204);
    });
    await t.test('each rollout family rolls back all domain BSON when event validation rejects the insert', async () => {
        const original = (await db.listCollections({ name: 'events' }).next()).options.validator;
        const cases = [
            ['POST', '/api/categories', { accountId, name: 'Rollback' }, 'category.created'],
            ['POST', '/api/member-incomes', { accountId, memberId: payer._id, amountMinor: 100, fromMonth: '2026-11' }, 'memberIncome.added'],
            ['POST', '/api/contribution-rules', { accountId, type: 'additional', recurring: false, amountMinor: 100, distribution: { mode: 'perMember', memberId: payer._id } }, 'contributionRule.added'],
            ['POST', '/api/category-budgets', { accountId, categoryId: category._id, amountMinor: 100, fromMonth: '2026-11' }, 'categoryBudget.added'],
            ['PUT', '/api/carryovers', { accountId, memberId: payer._id, month: '2026-11', amountMinor: 100 }, 'carryOver.set'],
            ['PUT', '/api/account-balances', { accountId, month: '2026-11', closingBalanceMinor: 100 }, 'accountBalance.set'],
            ['POST', '/api/transactions', { accountId, title: 'Rollback parent', type: 'expense', amountMinor: 100, month: '2026-11', isFromSharedAccount: true }, 'transaction.created'],
            ['POST', '/api/recurrences', { accountId, title: 'Rollback legacy', type: 'expense', amountMinor: 100, activeFrom: '2026-11' }, 'legacyRecurrence.created'],
            ['PATCH', `/api/accounts/${accountId}`, { name: 'Rollback account' }, 'account.settings.updated'],
            ['PATCH', `/api/members/${payer._id}`, { name: 'Rollback member' }, 'member.updated'],
            ['POST', '/api/accounts', { name: 'Rollback new account' }, 'account.created']
        ];
        try {
            for (const [method, path, body, code] of cases) {
                await db.command({ collMod: 'events', validator: { $and: [original, { code: { $ne: code } }] } });
                const before = await snapshot();
                await expectCall(alice, method, path, body, 500);
                assert.deepEqual(await snapshot(), before, `${code}: every domain document and event rolled back`);
            }
        } finally {
            await db.command({ collMod: 'events', validator: original });
        }
    });
    await t.test('every update/delete and membership endpoint aborts its actual domain writes when its event insert fails', async () => {
        const create = (path, body) => expectCall(alice, 'POST', path, { accountId, ...body }, 201);
        const income = await create('/api/member-incomes', { memberId: payer._id, amountMinor: 111, fromMonth: '2027-04' });
        const budget = await create('/api/category-budgets', { categoryId: category._id, amountMinor: 111, fromMonth: '2027-04' });
        const rule = await create('/api/contribution-rules', { type: 'additional', recurring: false, amountMinor: 111, distribution: { mode: 'perMember', memberId: payer._id } });
        const legacy = await create('/api/recurrences', { title: 'Fault legacy', type: 'expense', amountMinor: 111, activeFrom: '2027-04' });
        const cat = await create('/api/categories', { name: 'Fault unused category' });
        const parent = await create('/api/transactions', { title: 'Fault parent', type: 'expense', amountMinor: 1000, month: '2026-11', isFromSharedAccount: true });
        const childBody = { title: 'Fault child', type: 'expense', amountMinor: 300, month: '2026-11', isFromSharedAccount: true, parentTransactionId: parent._id };
        const child = await create('/api/transactions', childBody);
        const carryBody = { accountId, memberId: payer._id, month: '2027-04', amountMinor: 111 };
        const carry = await expectCall(alice, 'PUT', '/api/carryovers', carryBody, 200);
        const balanceBody = { accountId, month: '2027-04', closingBalanceMinor: 111 };
        const balance = await expectCall(alice, 'PUT', '/api/account-balances', balanceBody, 200);
        const spare = await expectCall(alice, 'POST', '/api/members', { name: 'Fault removable member' }, 201);
        await expectCall(alice, 'POST', `/api/accounts/${accountId}/members`, { memberId: spare._id, role: 'member' }, 200);
        const newMember = await expectCall(alice, 'POST', '/api/members', { name: 'Fault new membership' }, 201);
        const existingMembers = (await db.collection('accounts').findOne({ _id: new ObjectId(accountId) })).members;
        const cases = [
            ['PATCH', `/api/categories/${cat._id}`, { name: 'Changed fault category' }, 'category.updated'],
            ['DELETE', `/api/categories/${cat._id}`, undefined, 'category.deleted'],
            ['PATCH', `/api/member-incomes/${income._id}`, { amountMinor: 222 }, 'memberIncome.updated'],
            ['DELETE', `/api/member-incomes/${income._id}`, undefined, 'memberIncome.removed'],
            ['PATCH', `/api/category-budgets/${budget._id}`, { amountMinor: 222 }, 'categoryBudget.updated'],
            ['DELETE', `/api/category-budgets/${budget._id}`, undefined, 'categoryBudget.removed'],
            ['PATCH', `/api/contribution-rules/${rule._id}`, { amountMinor: 222 }, 'contributionRule.updated'],
            ['DELETE', `/api/contribution-rules/${rule._id}`, undefined, 'contributionRule.removed'],
            ['PUT', '/api/carryovers', { ...carryBody, amountMinor: 222 }, 'carryOver.set'],
            ['DELETE', `/api/carryovers/${carry._id}`, undefined, 'carryOver.removed'],
            ['PUT', '/api/account-balances', { ...balanceBody, closingBalanceMinor: 222 }, 'accountBalance.set'],
            ['DELETE', `/api/account-balances/${balance._id}`, undefined, 'accountBalance.removed'],
            ['PATCH', `/api/recurrences/${legacy._id}`, { title: 'Changed fault legacy' }, 'legacyRecurrence.updated'],
            ['DELETE', `/api/recurrences/${legacy._id}`, undefined, 'legacyRecurrence.deleted'],
            ['POST', '/api/transactions', { accountId, ...childBody, title: 'Second fault child' }, 'transaction.splitChildCreated'],
            ['PATCH', `/api/transactions/${child._id}`, { amountMinor: 400 }, 'transaction.updated'],
            ['PATCH', `/api/transactions/${parent._id}`, { status: 'booked', bookDate: '2026-11-07T00:00:00.000Z' }, 'transaction.booked'],
            ['DELETE', `/api/transactions/${child._id}`, undefined, 'transaction.splitChildDeleted'],
            ['DELETE', `/api/transactions/${parent._id}`, undefined, 'transaction.deleted'],
            ['POST', `/api/accounts/${accountId}/members`, { memberId: newMember._id, role: 'member' }, 'account.member.added'],
            ['POST', `/api/accounts/${accountId}/members`, { memberId: payer._id, role: 'owner' }, 'account.member.roleChanged'],
            ['DELETE', `/api/accounts/${accountId}/members/${spare._id}`, undefined, 'account.member.removed'],
            ['PATCH', `/api/accounts/${accountId}`, { name: 'Two-event rollback', members: existingMembers.map((m) => ({ memberId: String(m.memberId), role: String(m.memberId) === payer._id ? 'owner' : m.role })) }, 'account.member.roleChanged']
        ];
        const original = (await db.listCollections({ name: 'events' }).next()).options.validator;
        try {
            for (const [method, path, body, code] of cases) {
                await db.command({ collMod: 'events', validator: { $and: [original, { code: { $ne: code } }] } });
                const before = await snapshot();
                await expectCall(alice, method, path, body, 500);
                assert.deepEqual(await snapshot(), before, `${method} ${path}: rollback includes parent locks, base rules, all fanout and cents`);
            }
        } finally {
            await db.command({ collMod: 'events', validator: original });
        }
        const beforeReads = await snapshot();
        for (const path of ['transactions', 'categories', 'member-incomes', 'category-budgets', 'contribution-rules', 'carryovers', 'account-balances', 'recurrences'])
            await expectCall(alice, 'GET', `/api/${path}?accountId=${accountId}`, undefined, 200);
        assert.deepEqual(await snapshot(), beforeReads, 'all resource GETs remain read-only');
        assert.equal((await db.collection('transactions').findOne({ _id: new ObjectId(parent._id) })).amountMinor, 1000);
        assert.equal((await db.collection('transactions').findOne({ _id: new ObjectId(child._id) })).amountMinor, 300);
    });
    await t.test('EIT-12/31 proof-bound create survives actual HTTP reply loss, restart and parallel replay', async () => {
        const body = { accountId, title: 'Lost reply', type: 'expense', amountMinor: 1234, month: '2026-11', isFromSharedAccount: true };
        const headers = { authorization: `Bearer ${alice.token}`, 'content-type': 'application/json' };
        const beforeChallenge = await snapshot();
        const challenge = await fetch(base + '/api/transactions', { method: 'POST', headers, body: JSON.stringify(body) });
        assert.equal(challenge.status, 428);
        const proof = (await challenge.json()).creationProof;
        assert.deepEqual(await snapshot(), beforeChallenge, 'negotiation writes absolutely nothing');
        const proofHeaders = { ...headers, 'X-Tobu-Creation': proof };
        let committedStatus;
        const proxy = createHttpServer(async (request, response) => {
            try {
                const chunks = [];
                for await (const chunk of request) chunks.push(chunk);
                const upstream = await fetch(base + '/api/transactions', { method: 'POST', headers: proofHeaders, body: Buffer.concat(chunks) });
                committedStatus = upstream.status;
                await upstream.arrayBuffer(); // The actual API has completed its commit and response.
                response.socket.destroy(); // Destroy only this real successful HTTP response.
            } catch {
                response.destroy();
            }
        }).listen(0, '127.0.0.1');
        await once(proxy, 'listening');
        try {
            await assert.rejects(fetch(`http://127.0.0.1:${proxy.address().port}`, { method: 'POST', headers: proofHeaders, body: JSON.stringify(body) }));
            assert.equal(committedStatus, 201);
        } finally {
            await new Promise((resolve) => proxy.close(resolve));
        }
        const committed = await snapshot();
        await stop(api);
        api = spawn(process.execPath, [join(root, 'dist/src/server.js')], { cwd: scratch, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        api.stdout.on('data', (data) => (apiOutput += data));
        api.stderr.on('data', (data) => (apiOutput += data));
        for (let attempt = 0; attempt < 250; attempt++) {
            assert.equal(api.exitCode, null);
            try {
                if ((await fetch(base + '/ready')).ok) break;
            } catch {
                /* restart readiness */
            }
            await delay(100);
        }
        const responses = await Promise.all(Array.from({ length: 6 }, () => fetch(base + '/api/transactions', { method: 'POST', headers: proofHeaders, body: JSON.stringify(body) })));
        for (const response of responses) assert.equal(response.status, 201);
        const ids = await Promise.all(responses.map(async (r) => (await r.json())._id));
        assert.equal(new Set(ids).size, 1);
        assert.deepEqual(await snapshot(), committed, 'replay changes no BSON or updatedAt');
        for (const [who, payload, suppliedProof] of [
            [alice, { ...body, amountMinor: 2222 }, proof],
            [outsider, body, proof],
            [alice, body, proof + 'tampered']
        ]) {
            const response = await fetch(base + '/api/transactions', { method: 'POST', headers: { ...proofHeaders, authorization: `Bearer ${who.token}`, 'X-Tobu-Creation': suppliedProof }, body: JSON.stringify(payload) });
            assert.ok([404, 422].includes(response.status));
            assert.deepEqual(await snapshot(), committed);
        }
        // A consciously new creation negotiates a different domain id even for exactly the same payload.
        const second = await expectCall(alice, 'POST', '/api/transactions', body, 201);
        assert.notEqual(second._id, ids[0]);
        assert.equal(await db.collection('transactions').countDocuments({ title: body.title }), 2);
        assert.equal(
            (await db.collection('transactions').find({ title: body.title }).toArray()).reduce((sum, d) => sum + d.amountMinor, 0),
            2468
        );
    });
    await t.test('EIT-12 mutation retries cannot overwrite an intervening change, even after reply loss', async () => {
        const tx = await expectCall(alice, 'POST', '/api/transactions', { accountId, title: 'Revision retry', type: 'expense', amountMinor: 50, month: '2026-11', isFromSharedAccount: true }, 201);
        const headers = { authorization: `Bearer ${alice.token}`, 'content-type': 'application/json' };
        for (const [method, path, body, intervening] of [
            ['PATCH', `/api/transactions/${tx._id}`, { amountMinor: 1000 }, { amountMinor: 2000 }],
            ['PUT', '/api/account-balances', { accountId, month: '2027-03', closingBalanceMinor: 1000 }, { accountId, month: '2027-03', closingBalanceMinor: 2000 }],
            ['PUT', '/api/carryovers', { accountId, month: '2027-03', memberId: payer._id, amountMinor: 1000 }, { accountId, month: '2027-03', memberId: payer._id, amountMinor: 2000 }]
        ]) {
            const beforeChallenge = await snapshot();
            const challenge = await fetch(base + path, { method, headers, body: JSON.stringify(body) });
            assert.equal(challenge.status, 428);
            const proof = (await challenge.json()).mutationProof;
            assert.deepEqual(await snapshot(), beforeChallenge);
            const bound = { ...headers, 'X-Tobu-Mutation': proof };
            let status;
            const proxy = createHttpServer(async (_request, response) => {
                try {
                    const upstream = await fetch(base + path, { method, headers: bound, body: JSON.stringify(body) });
                    status = upstream.status;
                    await upstream.arrayBuffer();
                    response.socket.destroy();
                } catch {
                    response.destroy();
                }
            }).listen(0, '127.0.0.1');
            await once(proxy, 'listening');
            try {
                await assert.rejects(fetch(`http://127.0.0.1:${proxy.address().port}`, { method, headers, body: JSON.stringify(body) }));
                assert.equal(status, 200);
            } finally {
                await new Promise((resolve) => proxy.close(resolve));
            }
            const committed = await snapshot();
            const equalRetry = await fetch(base + path, { method, headers: bound, body: JSON.stringify(body) });
            assert.equal(equalRetry.status, 200);
            assert.deepEqual(await snapshot(), committed, 'equal retry is write-free');
            await expectCall(alice, method, path, intervening, 200);
            const afterOther = await snapshot();
            const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(base + path, { method, headers: bound, body: JSON.stringify(body) })));
            for (const response of responses) {
                assert.equal(response.status, 409);
                assert.equal((await response.json()).error, 'MUTATION_REVISION_STALE');
            }
            assert.deepEqual(await snapshot(), afterOther, 'old action cannot overwrite newer finance or create another event');
            const forged = await fetch(base + path, { method, headers: { ...bound, 'X-Tobu-Mutation': proof + 'tampered' }, body: JSON.stringify(body) });
            assert.equal(forged.status, 422);
            assert.deepEqual(await snapshot(), afterOther);
        }
    });
    await t.test('durable receipt recovery reads the committed result without reexecuting domain work', async () => {
        const created = await expectCall(alice, 'POST', '/api/transactions', { accountId, title: 'Original recovery title', type: 'expense', amountMinor: 921, month: '2026-11', isFromSharedAccount: true }, 201);
        const original = await db.collection('transactions').findOne({ _id: new ObjectId(created._id) });
        const receipt = await db.collection('events').findOne({ code: 'transaction.created', 'subject.id': created._id });
        await expectCall(alice, 'PATCH', `/api/transactions/${created._id}`, { title: 'Intervening recovery title', amountMinor: 922 }, 200);
        const before = await snapshot();
        const previousEnv = {};
        for (const name of Object.keys(env).filter((name) => name.startsWith('JWT_'))) {
            previousEnv[name] = process.env[name];
            process.env[name] = env[name];
        }
        const { default: mongoose } = await import('mongoose');
        const { default: express } = await import('express');
        const { requireAuth } = await import('../../dist/src/auth/middleware.js');
        const { resolveAccountContext } = await import('../../dist/src/auth/account-context.js');
        const { activityRoute, creationReply } = await import('../../dist/src/services/activity-route.js');
        const { default: Transaction } = await import('../../dist/src/models/Transaction.js');
        let workCalls = 0,
            domainCalls = 0;
        await mongoose.connect(uri, { autoCreate: false, autoIndex: false });
        const fixture = express();
        fixture.use(requireAuth);
        fixture.post('/recovery-fixture', async (req, res) => {
            const context = await resolveAccountContext(req, accountId);
            return activityRoute(
                req,
                res,
                async (session, emit) => {
                    workCalls++;
                    await emit(context, `transaction:create:${created._id}`, [{ code: receipt.code, subject: receipt.subject, params: receipt.params }], async () => {
                        domainCalls++;
                        throw new Error('must not mutate a committed receipt');
                    });
                    // A real post-replay response-construction failure, not a mocked writer result.
                    await Transaction.create([original], { session }); // actual Mongo duplicate key
                    throw new Error('unreachable');
                },
                req.query.reader === 'absent' ? undefined : async (session) => creationReply(await Transaction.findById(created._id).session(session))
            );
        });
        const server = fixture.listen(0, '127.0.0.1');
        await once(server, 'listening');
        try {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/recovery-fixture`, { method: 'POST', headers: { authorization: `Bearer ${alice.token}` } });
            assert.equal(response.status, 201);
            assert.equal((await response.json()).title, 'Intervening recovery title');
            assert.equal(workCalls, 1);
            assert.equal(domainCalls, 0);
            assert.deepEqual(await snapshot(), before);
            const unavailable = await fetch(`http://127.0.0.1:${server.address().port}/recovery-fixture?reader=absent`, { method: 'POST', headers: { authorization: `Bearer ${alice.token}` } });
            assert.equal(unavailable.status, 503);
            assert.equal((await unavailable.json()).error, 'ACTIVITY_COMMITTED_RESPONSE_UNAVAILABLE');
            assert.equal(workCalls, 2);
            assert.equal(domainCalls, 0);
            assert.deepEqual(await snapshot(), before);
        } finally {
            await new Promise((resolve) => server.close(resolve));
            await mongoose.disconnect();
            for (const [name, value] of Object.entries(previousEnv)) {
                if (value === undefined) delete process.env[name];
                else process.env[name] = value;
            }
        }
    });
    await t.test('old create proofs never resurrect deleted domain subjects or user-scoped members', async () => {
        const replayMember = await expectCall(alice, 'POST', '/api/members', { name: 'Replay income member' }, 201);
        await expectCall(alice, 'POST', `/api/accounts/${accountId}/members`, { memberId: replayMember._id, role: 'member' }, 200);
        const budgetCategory = await expectCall(alice, 'POST', '/api/categories', { accountId, name: 'Replay budget category' }, 201);
        const headers = { authorization: `Bearer ${alice.token}`, 'content-type': 'application/json' };
        const cases = [
            ['/api/transactions', { accountId, title: 'Deleted proof transaction', type: 'expense', amountMinor: 555, month: '2029-03', isFromSharedAccount: true }],
            ['/api/categories', { accountId, name: 'Deleted proof category' }],
            ['/api/member-incomes', { accountId, memberId: replayMember._id, amountMinor: 555, fromMonth: '2029-03' }],
            ['/api/category-budgets', { accountId, categoryId: budgetCategory._id, amountMinor: 555, fromMonth: '2029-03' }],
            ['/api/contribution-rules', { accountId, type: 'additional', recurring: false, amountMinor: 555, distribution: { mode: 'perMember', memberId: replayMember._id } }],
            ['/api/recurrences', { accountId, title: 'Deleted legacy proof', type: 'expense', amountMinor: 555, activeFrom: '2029-03' }],
            ['/api/members', { name: 'Deleted orphan proof' }]
        ];
        for (const [path, body] of cases) {
            const challenge = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
            assert.equal(challenge.status, 428);
            const proof = (await challenge.json()).creationProof;
            const options = { method: 'POST', headers: { ...headers, 'X-Tobu-Creation': proof }, body: JSON.stringify(body) };
            const created = await fetch(base + path, options);
            assert.equal(created.status, 201);
            const doc = await created.json();
            await expectCall(alice, 'DELETE', `${path}/${doc._id}`, undefined, 204);
            const before = await snapshot();
            const userVersion = (await db.collection('users').findOne({ _id: new ObjectId(alice.userId) }, { projection: { __v: 1 } })).__v;
            const replay = await fetch(base + path, options);
            assert.equal(replay.status, path === '/api/members' ? 409 : 410, path);
            assert.deepEqual(await snapshot(), before, 'zero new domain/event writes after deleted-subject replay');
            assert.equal((await db.collection('users').findOne({ _id: new ObjectId(alice.userId) }, { projection: { __v: 1 } })).__v, userVersion, 'even the user revision stays unchanged');
        }
    });
    await t.test('case-insensitive public IDs stay canonical in new events and self-owner membership', async () => {
        const self = account.members.find((m) => m.role === 'owner').memberId;
        const upper = await expectCall(alice, 'POST', '/api/accounts', { name: 'Upper-case self id', members: [{ memberId: self.toUpperCase(), role: 'member' }] }, 201);
        assert.equal(upper.members.filter((m) => m.memberId === self).length, 1);
        assert.equal(upper.members.find((m) => m.memberId === self).role, 'owner');
        for (const requested of [
            [self, payer._id],
            [payer._id, self]
        ]) {
            const ordered = await expectCall(alice, 'POST', '/api/accounts', { name: 'Preserve requested member order', members: requested.map((memberId) => ({ memberId, role: 'member' })) }, 201);
            assert.deepEqual(
                ordered.members.map((member) => member.memberId),
                requested
            );
            assert.equal(ordered.members.find((member) => member.memberId === self).role, 'owner', 'verified identity wins at either list position');
            // Keep the later Bob assignment race focused on its original shared account.
            await expectCall(alice, 'DELETE', `/api/accounts/${ordered._id}/members/${payer._id}`, undefined, 200);
        }
        const tx = await mutation(
            'POST',
            '/api/transactions',
            { accountId: accountId.toUpperCase(), title: 'Upper ids', type: 'expense', amountMinor: 321, month: '2026-11', isFromSharedAccount: false, paidByMemberId: payer._id.toUpperCase(), categoryId: category._id.toUpperCase() },
            ['transaction.created']
        );
        const event = await db.collection('events').findOne({ 'params.transactionId': tx._id });
        assert.equal(event.params.categoryId, category._id);
        await mutation('DELETE', `/api/transactions/${tx._id}`, undefined, ['transaction.deleted']);
    });
    await t.test('EIT-18/32 Member assignment serializes against global member update and delete', async () => {
        const before = await db.collection('members').findOne({ _id: new ObjectId(payer._id) });
        const eventCount = await db.collection('events').countDocuments({ code: 'member.updated' });
        const priorPatchIds = (
            await db
                .collection('events')
                .find({ code: 'member.updated', 'subject.id': payer._id }, { projection: { _id: 1 } })
                .toArray()
        ).map((event) => event._id);
        const configured = await client.db('admin').command({ configureFailPoint: 'failCommand', mode: { times: 1 }, data: { failCommands: ['update'], blockConnection: true, blockTimeMS: 1500 } });
        const patch = call(alice.token, 'PATCH', `/api/members/${payer._id}`, { name: 'Should roll back after assignment' });
        await client.db('admin').command({ waitForFailPoint: 'failCommand', timesEntered: configured.count + 1, maxTimeMS: 5000 });
        const other = await expectCall(bob, 'POST', '/api/accounts', { name: 'Bob shared member', members: [{ memberId: payer._id }] }, 201);
        const patched = await patch;
        assert.ok([200, 404].includes(patched.status), 'either authorized edit commits first, or later edit sees inaccessible assignment');
        assert.equal((await db.collection('members').findOne({ _id: new ObjectId(payer._id) })).name, patched.status === 200 ? 'Should roll back after assignment' : before.name);
        assert.equal(await db.collection('events').countDocuments({ code: 'member.updated' }), eventCount + (patched.status === 200 ? 1 : 0));
        assert.equal(await db.collection('events').countDocuments({ accountId: new ObjectId(other._id), code: 'member.updated' }), 0, 'no global edit can bypass the inaccessible new account');
        if (patched.status === 200) {
            // Prove real commit order. event.date is assigned before a blocked write and cannot prove this.
            const patchEvent = await db.collection('events').findOne({ code: 'member.updated', 'subject.id': payer._id, _id: { $nin: priorPatchIds } });
            const assignmentEvent = await db.collection('events').findOne({ code: 'account.created', 'subject.id': other._id });
            assert.ok(patchEvent && assignmentEvent);
            const oplog = client.db('local').collection('oplog.rs');
            const committedSlot = (event) => oplog.findOne({ 'o.applyOps': { $elemMatch: { ns: `${dbName}.events`, op: 'i', 'o._id': event._id } } });
            const patchCommit = await committedSlot(patchEvent);
            const assignmentCommit = await committedSlot(assignmentEvent);
            assert.ok(patchCommit?.ts && assignmentCommit?.ts, 'both event slots have real transactional applyOps commit records');
            assert.ok(patchCommit.ts.compare(assignmentCommit.ts) < 0, 'successful global edit committed BEFORE inaccessible assignment; stale edit after assignment is forbidden');
        }
        assert.ok(other.members.some((m) => m.memberId === payer._id));
        const orphan = await expectCall(alice, 'POST', '/api/members', { name: 'Delete race orphan' }, 201);
        const beforeRaceEvents = await db.collection('events').countDocuments();
        const blockedDelete = await client.db('admin').command({ configureFailPoint: 'failCommand', mode: { times: 1 }, data: { failCommands: ['delete'], blockConnection: true, blockTimeMS: 1500 } });
        const deletion = call(alice.token, 'DELETE', `/api/members/${orphan._id}`);
        await client.db('admin').command({ waitForFailPoint: 'failCommand', timesEntered: blockedDelete.count + 1, maxTimeMS: 5000 });
        const assigned = await call(alice.token, 'POST', '/api/accounts', { name: 'Preserve assigned orphan', members: [{ memberId: orphan._id }] });
        const deleted = await deletion;
        if (assigned.status === 201) {
            assert.equal(deleted.status, 409);
            assert.equal(deleted.json.error, 'MEMBER_IN_USE');
            assert.ok(await db.collection('members').findOne({ _id: new ObjectId(orphan._id) }));
            assert.ok(assigned.json.members.some((m) => m.memberId === orphan._id));
        } else {
            assert.equal(assigned.status, 422);
            assert.equal(assigned.json.error, 'MEMBER_NOT_ASSIGNABLE');
            assert.equal(deleted.status, 204);
            assert.equal(await db.collection('members').countDocuments({ _id: new ObjectId(orphan._id) }), 0);
            assert.equal(await db.collection('accounts').countDocuments({ 'members.memberId': new ObjectId(orphan._id) }), 0, 'no dangling assignment when delete wins');
            assert.equal(await db.collection('accounts').countDocuments({ name: 'Preserve assigned orphan' }), 0, 'failed assignment does not leave a partial account');
        }
        assert.equal(await db.collection('events').countDocuments(), beforeRaceEvents + (assigned.status === 201 ? 1 : 0));
        await client.db('admin').command({ configureFailPoint: 'failCommand', mode: 'off' });
    });
});
