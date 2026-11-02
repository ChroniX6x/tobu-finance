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
const NOV = new Date('2026-11-01T00:00:00.000Z');

test('account membership: two real users on a real replica set, 404 for everything that is not theirs', { timeout: 300000 }, async (t) => {
    const endpoint = process.env.TEST_MONGODB_URI;
    assert.ok(endpoint, 'Provide TEST_MONGODB_URI for a dedicated replica-set test server (npm run test:integration)');
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
    t.after(async () => {
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
    });
    await client.connect();
    assert.ok((await client.db('admin').command({ hello: 1 })).setName, 'Transactions need a replica set');

    const init = spawn(process.execPath, [join(root, 'dist/src/database/cli.js'), 'init'], { cwd: scratch, env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri }, windowsHide: true, stdio: 'inherit' });
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
        const response = await fetch(base + path, {
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
        return out;
    };
    const register = async (name) => {
        const email = `${name}@example.test`;
        const password = `${name}-test-password`;
        const reg = await call(undefined, 'POST', '/api/auth/register', { email, password, name });
        assert.equal(reg.status, 201);
        return { token: reg.json.accessToken, userId: reg.json.user.id, email, password };
    };
    const alice = await register('alice');
    const bob = await register('bob');
    const admin = await register('admin');
    await db.collection('users').updateOne({ _id: new ObjectId(admin.userId) }, { $set: { roles: ['admin', 'user'] } });
    const adminLogin = await call(undefined, 'POST', '/api/auth/login', { email: admin.email, password: admin.password });
    assert.equal(adminLogin.status, 200);
    assert.ok(adminLogin.json.user.roles.includes('admin'));
    admin.token = adminLogin.json.accessToken;

    // Everything below is created through the public API with the owning user's token.
    async function seed(who, label) {
        const member = (await call(who.token, 'POST', '/api/members', { name: `${label} owner`, email: who.email, userId: who.userId })).json;
        const partner = (await call(who.token, 'POST', '/api/members', { name: `${label} partner`, email: `${label}-partner@example.test` })).json;
        const spare = (await call(who.token, 'POST', '/api/members', { name: `${label} spare` })).json;
        const account = await call(who.token, 'POST', '/api/accounts', { name: label, members: [{ memberId: member._id }, { memberId: partner._id }] });
        assert.equal(account.status, 201, account.text);
        const acc = account.json._id;
        const category = (await call(who.token, 'POST', '/api/categories', { accountId: acc, name: `${label} cat` })).json;
        const parent = await call(who.token, 'POST', '/api/transactions', { accountId: acc, title: `${label} parent`, type: 'expense', amountMinor: 1000, isFromSharedAccount: true, month: '2026-11' });
        assert.equal(parent.status, 201, parent.text);
        const child = await call(who.token, 'POST', '/api/transactions', { accountId: acc, title: `${label} child`, type: 'expense', amountMinor: 400, isFromSharedAccount: true, month: '2026-11', parentTransactionId: parent.json._id });
        assert.equal(child.status, 201, child.text);
        const balance = await call(who.token, 'PUT', '/api/account-balances', { accountId: acc, month: '2026-11', closingBalanceMinor: 5000 });
        const carry = await call(who.token, 'PUT', '/api/carryovers', { accountId: acc, memberId: member._id, month: '2026-11', amountMinor: 100 });
        const budget = await call(who.token, 'POST', '/api/category-budgets', { accountId: acc, categoryId: category._id, amountMinor: 1000, fromMonth: '2026-11', toMonth: '2026-12' });
        const income = await call(who.token, 'POST', '/api/member-incomes', { accountId: acc, memberId: member._id, amountMinor: 20000, fromMonth: '2026-11', toMonth: '2026-12' });
        const rule = await call(who.token, 'POST', '/api/contribution-rules', { accountId: acc, type: 'additional', recurring: false, amountMinor: 500, distribution: { mode: 'perMember', memberId: member._id }, fromMonth: '2026-11' });
        const rec = await call(who.token, 'POST', '/api/recurrences', { accountId: acc, type: 'expense', amountMinor: 100, title: `${label} rent`, categoryId: category._id, createdByMemberId: member._id });
        for (const [name, response] of Object.entries({ balance, carry, budget, income, rule, rec })) assert.ok([200, 201].includes(response.status), `${label} ${name}: ${response.text}`);
        return {
            acc,
            member: member._id,
            partner: partner._id,
            spare: spare._id,
            category: category._id,
            rec: rec.json._id,
            tx: parent.json._id,
            child: child.json._id,
            balance: balance.json._id,
            carry: carry.json._id,
            budget: budget.json._id,
            income: income.json._id,
            rule: rule.json._id
        };
    }
    const A = await seed(alice, 'alice');
    const B = await seed(bob, 'bob');

    // Legacy account: listed members have no linked login. Written directly, as old data would exist.
    const legacyMember = new ObjectId();
    const legacyAccount = new ObjectId();
    const L = { acc: String(legacyAccount), member: String(legacyMember), partner: String(legacyMember), spare: String(new ObjectId()), category: String(new ObjectId()) };
    await db.collection('members').insertOne({ _id: legacyMember, name: 'Legacy', email: 'legacy@example.test', userId: null });
    await db.collection('accounts').insertOne({ _id: legacyAccount, name: 'Legacy', currency: 'EUR', members: [{ memberId: legacyMember, role: 'owner' }] });
    await db.collection('categories').insertOne({ _id: new ObjectId(L.category), accountId: legacyAccount, name: 'Legacy cat', customSplit: [] });
    for (const [key, collection, doc] of [
        ['rec', 'recurrences', { accountId: legacyAccount, categoryId: new ObjectId(L.category), title: 'Legacy rent', type: 'expense', amountMinor: 1, schedule: { freq: 'monthly', dayOfMonth: 1 }, activeFrom: new Date(NOV), activeUntil: null }],
        [
            'tx',
            'transactions',
            { accountId: legacyAccount, title: 'Legacy', type: 'expense', amountMinor: 700, status: 'pending', month: NOV, bookDate: null, isFromSharedAccount: true, parentTransactionId: null, categoryId: null, paidByMemberId: null }
        ],
        ['balance', 'account_balances', { accountId: legacyAccount, month: NOV, closingBalanceMinor: 1 }],
        ['carry', 'carryovers', { accountId: legacyAccount, memberId: legacyMember, month: NOV, amountMinor: 1, reason: '' }],
        ['budget', 'category_budgets', { accountId: legacyAccount, categoryId: new ObjectId(L.category), amountMinor: 1, fromMonth: NOV, toMonth: null }],
        ['income', 'member_incomes', { accountId: legacyAccount, memberId: legacyMember, amountMinor: 1, fromMonth: NOV, toMonth: null }],
        ['rule', 'contribution_rules', { accountId: legacyAccount, type: 'additional', recurring: false, amountMinor: 1, distribution: { mode: 'perMember', memberId: legacyMember, customSplit: null }, fromMonth: NOV, toMonth: null }]
    ]) {
        const { insertedId } = await db.collection(collection).insertOne(doc);
        L[key] = String(insertedId);
    }
    // A completely unknown account and unknown documents.
    const U = Object.fromEntries(['acc', 'member', 'partner', 'spare', 'category', 'rec', 'tx', 'balance', 'carry', 'budget', 'income', 'rule'].map((key) => [key, String(new ObjectId())]));

    // One entry per route and method. Bodies are valid for the target so that only authorization can reject them.
    const month = '2026-11';
    const matrix = (x) => [
        ['GET /api/transactions', 'GET', `/api/transactions?accountId=${x.acc}`],
        ['GET /api/transactions (children)', 'GET', `/api/transactions?accountId=${x.acc}&parentTransactionId=${x.tx}`],
        ['POST /api/transactions', 'POST', '/api/transactions', { accountId: x.acc, title: 'nn', type: 'expense', amountMinor: 100, isFromSharedAccount: true, month }],
        ['POST /api/transactions (split child)', 'POST', '/api/transactions', { accountId: x.acc, title: 'nn', type: 'expense', amountMinor: 100, isFromSharedAccount: true, month, parentTransactionId: x.tx }],
        ['PATCH /api/transactions/:id', 'PATCH', `/api/transactions/${x.tx}`, { title: 'changed' }],
        ['DELETE /api/transactions/:id', 'DELETE', `/api/transactions/${x.tx}`],
        ['GET /api/accounts/:id/month-view', 'GET', `/api/accounts/${x.acc}/month-view?month=${month}`],
        ['GET /api/accounts/:id/overview', 'GET', `/api/accounts/${x.acc}/overview`],
        ['GET /api/accounts/:id/planning', 'GET', `/api/accounts/${x.acc}/planning?month=${month}`],
        ['GET /api/accounts/:id/master-data', 'GET', `/api/accounts/${x.acc}/master-data`],
        ['GET /api/accounts/:id', 'GET', `/api/accounts/${x.acc}`],
        ['GET /api/accounts/:id/expanded', 'GET', `/api/accounts/${x.acc}/expanded?include=members&include=transactions&include=categories&include=accountBalances`],
        ['PATCH /api/accounts/:id', 'PATCH', `/api/accounts/${x.acc}`, { name: 'changed' }],
        ['POST /api/accounts/:id/members', 'POST', `/api/accounts/${x.acc}/members`, { memberId: x.spare, role: 'member' }],
        ['DELETE /api/accounts/:id/members/:memberId', 'DELETE', `/api/accounts/${x.acc}/members/${x.partner}`],
        ['GET /api/account-balances', 'GET', `/api/account-balances?accountId=${x.acc}`],
        ['PUT /api/account-balances', 'PUT', '/api/account-balances', { accountId: x.acc, month, closingBalanceMinor: 1 }],
        ['DELETE /api/account-balances/:id', 'DELETE', `/api/account-balances/${x.balance}`],
        ['GET /api/carryovers', 'GET', `/api/carryovers?accountId=${x.acc}`],
        ['PUT /api/carryovers', 'PUT', '/api/carryovers', { accountId: x.acc, memberId: x.member, month, amountMinor: 1 }],
        ['DELETE /api/carryovers/:id', 'DELETE', `/api/carryovers/${x.carry}`],
        ['GET /api/category-budgets', 'GET', `/api/category-budgets?accountId=${x.acc}`],
        ['POST /api/category-budgets', 'POST', '/api/category-budgets', { accountId: x.acc, categoryId: x.category, amountMinor: 1, fromMonth: '2027-01' }],
        ['PATCH /api/category-budgets/:id', 'PATCH', `/api/category-budgets/${x.budget}`, { amountMinor: 2 }],
        ['DELETE /api/category-budgets/:id', 'DELETE', `/api/category-budgets/${x.budget}`],
        ['GET /api/member-incomes', 'GET', `/api/member-incomes?accountId=${x.acc}`],
        ['POST /api/member-incomes', 'POST', '/api/member-incomes', { accountId: x.acc, memberId: x.member, amountMinor: 1, fromMonth: '2027-01' }],
        ['PATCH /api/member-incomes/:id', 'PATCH', `/api/member-incomes/${x.income}`, { amountMinor: 2 }],
        ['DELETE /api/member-incomes/:id', 'DELETE', `/api/member-incomes/${x.income}`],
        ['GET /api/contribution-rules', 'GET', `/api/contribution-rules?accountId=${x.acc}`],
        ['POST /api/contribution-rules', 'POST', '/api/contribution-rules', { accountId: x.acc, type: 'additional', recurring: false, amountMinor: 1, distribution: { mode: 'perMember', memberId: x.member }, fromMonth: '2027-01' }],
        ['PATCH /api/contribution-rules/:id', 'PATCH', `/api/contribution-rules/${x.rule}`, { amountMinor: 2 }],
        ['DELETE /api/contribution-rules/:id', 'DELETE', `/api/contribution-rules/${x.rule}`],
        ['GET /api/categories', 'GET', `/api/categories?accountId=${x.acc}`],
        ['POST /api/categories', 'POST', '/api/categories', { accountId: x.acc, name: 'nn' }],
        ['PATCH /api/categories/:id', 'PATCH', `/api/categories/${x.category}`, { name: 'changed' }],
        ['DELETE /api/categories/:id', 'DELETE', `/api/categories/${x.category}`],
        ['PATCH /api/categories/:id (accountId of the caller)', 'PATCH', `/api/categories/${x.category}`, { accountId: A.acc, name: 'changed' }],
        ['PATCH /api/recurrences/:id (accountId of the caller)', 'PATCH', `/api/recurrences/${x.rec}`, { accountId: A.acc, title: 'changed' }],
        ['GET /api/recurrences', 'GET', `/api/recurrences?accountId=${x.acc}`],
        ['POST /api/recurrences', 'POST', '/api/recurrences', { accountId: x.acc, type: 'expense', amountMinor: 1, title: 'nn' }],
        ['PATCH /api/recurrences/:id', 'PATCH', `/api/recurrences/${x.rec}`, { title: 'changed' }],
        ['DELETE /api/recurrences/:id', 'DELETE', `/api/recurrences/${x.rec}`]
    ];
    assert.equal(matrix(B).length, 43);

    const expectNoWrites = async (label, work, check) => {
        const before = await snapshot();
        const response = await work();
        check(response);
        assert.deepEqual(await snapshot(), before, `${label}: changed data or events`);
    };

    await t.test('matrix: a stranger gets 404 on a foreign account, an unknown account and a legacy account (no write, no event, no body)', async () => {
        for (const [targetName, target] of [
            ['foreign (bob)', B],
            ['unknown', U],
            ['legacy without a linked user', L]
        ]) {
            for (const [name, method, path, body] of matrix(target)) {
                await expectNoWrites(
                    `${name} on ${targetName}`,
                    () => call(alice.token, method, path, body),
                    (r) => {
                        assert.equal(r.status, 404, `${name} on ${targetName}: ${r.status} ${r.text}`);
                        assert.ok(!/bob|legacy/i.test(r.text), `${name} on ${targetName} leaked data: ${r.text}`);
                    }
                );
            }
        }
    });

    await t.test('matrix: the foreign, unknown and legacy answers are identical (no existence oracle)', async () => {
        for (const [name, method, path, body] of matrix(B)) {
            const answers = new Set();
            for (const target of [B, U, L]) {
                const [, m, p, b] = matrix(target).find(([n]) => n === name);
                const r = await call(alice.token, m, p, b);
                answers.add(`${r.status}|${r.text}`);
            }
            assert.equal(answers.size, 1, `${name}: ${[...answers].join(' / ')}`);
            void method;
            void path;
            void body;
        }
    });

    await t.test('matrix: the global admin role gives no access to a foreign account', async () => {
        for (const [name, method, path, body] of matrix(A)) {
            await expectNoWrites(
                `${name} as admin`,
                () => call(admin.token, method, path, body),
                (r) => assert.equal(r.status, 404, `${name}: ${r.status} ${r.text}`)
            );
        }
    });

    await t.test('matrix: 401 without a token or with an invalid token, nothing written', async () => {
        for (const token of [undefined, 'invalid']) {
            for (const [name, method, path, body] of matrix(A)) {
                await expectNoWrites(
                    `${name} unauthenticated`,
                    () => call(token, method, path, body),
                    (r) => assert.equal(r.status, 401, `${name}: ${r.status}`)
                );
            }
        }
    });

    await t.test('a member can read and change their own account on every route (no role difference needed)', async () => {
        const ok = async (method, path, body, ...statuses) => {
            const r = await call(alice.token, method, path, body);
            assert.ok(statuses.includes(r.status), `${method} ${path}: ${r.status} ${r.text}`);
            return r;
        };
        const partnerOnly = alice; // both Alice's members belong to her account; she is the linked one
        assert.ok(partnerOnly);
        assert.ok((await ok('GET', `/api/transactions?accountId=${A.acc}`, undefined, 200)).json.items.some((i) => i._id === A.tx));
        await ok('GET', `/api/transactions?accountId=${A.acc}&parentTransactionId=${A.tx}`, undefined, 200);
        for (const path of ['month-view?month=2026-11', 'overview', 'planning?month=2026-11', 'master-data', '', 'expanded?include=members&include=transactions&include=categories']) {
            await ok('GET', `/api/accounts/${A.acc}${path ? `/${path}` : ''}`, undefined, 200);
        }
        for (const path of [`account-balances?accountId=${A.acc}`, `carryovers?accountId=${A.acc}`, `category-budgets?accountId=${A.acc}`, `member-incomes?accountId=${A.acc}`, `contribution-rules?accountId=${A.acc}`]) {
            const r = await ok('GET', `/api/${path}`, undefined, 200);
            assert.ok(r.json.length >= 1, path);
            assert.ok(r.json.every((d) => String(d.accountId) === A.acc));
        }
        const created = await ok('POST', '/api/transactions', { accountId: A.acc, title: 'second', type: 'expense', amountMinor: 50, isFromSharedAccount: true, month: '2026-11', categoryId: A.category, paidByMemberId: A.member }, 201);
        await ok('PATCH', `/api/transactions/${created.json._id}`, { title: 'renamed', categoryId: A.category }, 200);
        await ok('POST', '/api/transactions', { accountId: A.acc, title: 'split', type: 'expense', amountMinor: 100, isFromSharedAccount: true, month: '2026-11', parentTransactionId: A.tx }, 201);
        await ok('DELETE', `/api/transactions/${created.json._id}`, undefined, 204);
        await ok('PATCH', `/api/accounts/${A.acc}`, { name: 'alice renamed' }, 200);
        await ok('POST', `/api/accounts/${A.acc}/members`, { memberId: A.spare, role: 'member' }, 200);
        await ok('DELETE', `/api/accounts/${A.acc}/members/${A.spare}`, undefined, 200);
        await ok('PUT', '/api/account-balances', { accountId: A.acc, month: '2026-12', closingBalanceMinor: 1 }, 200);
        await ok('PUT', '/api/carryovers', { accountId: A.acc, memberId: A.partner, month: '2026-12', amountMinor: 5 }, 200);
        const budget = await ok('POST', '/api/category-budgets', { accountId: A.acc, categoryId: A.category, amountMinor: 1, fromMonth: '2027-01' }, 201);
        await ok('PATCH', `/api/category-budgets/${budget.json._id}`, { amountMinor: 3 }, 200);
        await ok('DELETE', `/api/category-budgets/${budget.json._id}`, undefined, 204);
        const income = await ok('POST', '/api/member-incomes', { accountId: A.acc, memberId: A.partner, amountMinor: 1, fromMonth: '2027-01' }, 201);
        await ok('PATCH', `/api/member-incomes/${income.json._id}`, { amountMinor: 3 }, 200);
        await ok('DELETE', `/api/member-incomes/${income.json._id}`, undefined, 204);
        const rule = await ok(
            'POST',
            '/api/contribution-rules',
            { accountId: A.acc, type: 'additional', recurring: false, amountMinor: 1, distribution: { mode: 'perMember', memberId: A.partner }, fromMonth: '2027-01', createdByMemberId: A.member },
            201
        );
        await ok('PATCH', `/api/contribution-rules/${rule.json._id}`, { amountMinor: 3 }, 200);
        await ok('DELETE', `/api/contribution-rules/${rule.json._id}`, undefined, 204);
        // categories and recurrences: same rules, own account only
        const listedCategories = await ok('GET', `/api/categories?accountId=${A.acc}`, undefined, 200);
        assert.ok(listedCategories.json.length >= 1 && listedCategories.json.every((c) => String(c.accountId) === A.acc));
        const cat = await ok('POST', '/api/categories', { accountId: A.acc, name: 'own cat', customSplit: [{ memberId: A.member, split: 100 }] }, 201);
        await ok('PATCH', `/api/categories/${cat.json._id}`, { name: 'own cat renamed', customSplit: [{ memberId: A.partner, split: 100 }] }, 200);
        const sameAccount = await ok('PATCH', `/api/categories/${cat.json._id}`, { accountId: A.acc, name: 'same account is accepted and ignored' }, 200);
        assert.equal(String(sameAccount.json.accountId), A.acc);
        await ok('DELETE', `/api/categories/${cat.json._id}`, undefined, 204);
        const listedRecurrences = await ok('GET', `/api/recurrences?accountId=${A.acc}`, undefined, 200);
        assert.ok(listedRecurrences.json.length >= 1 && listedRecurrences.json.every((c) => String(c.accountId) === A.acc));
        const recurrence = await ok('POST', '/api/recurrences', { accountId: A.acc, type: 'expense', amountMinor: 5, title: 'own rec', categoryId: A.category, createdByMemberId: A.partner }, 201);
        await ok('PATCH', `/api/recurrences/${recurrence.json._id}`, { title: 'renamed', categoryId: A.category, accountId: A.acc }, 200);
        await ok('DELETE', `/api/recurrences/${recurrence.json._id}`, undefined, 204);
        await ok('DELETE', `/api/account-balances/${A.balance}`, undefined, 204);
        await ok('DELETE', `/api/carryovers/${A.carry}`, undefined, 204);
    });

    await t.test('list routes without accountId only show the caller’s accounts', async () => {
        for (const path of ['account-balances', 'carryovers', 'category-budgets', 'member-incomes', 'contribution-rules', 'categories', 'recurrences']) {
            const r = await call(bob.token, 'GET', `/api/${path}`);
            assert.equal(r.status, 200);
            assert.ok(r.json.length >= 1 && r.json.every((d) => String(d.accountId) === B.acc), `${path}: ${r.text}`);
        }
        const accounts = (await call(bob.token, 'GET', '/api/accounts')).json;
        assert.deepEqual(
            accounts.map((a) => a._id),
            [B.acc]
        );
        const nobody = await register('nobody');
        for (const path of ['accounts', 'members', 'account-balances', 'carryovers', 'category-budgets', 'member-incomes', 'contribution-rules', 'categories', 'recurrences', 'accounts/summary']) {
            const r = await call(nobody.token, 'GET', `/api/${path}`);
            assert.deepEqual([r.status, r.json], [200, []], path);
        }
        assert.equal((await call(nobody.token, 'GET', `/api/transactions?accountId=${A.acc}`)).status, 404);
    });

    await t.test('foreign category, member, parent and recurrence in own requests are rejected without any write', async () => {
        const rejected = async (label, method, path, body, status, error) =>
            expectNoWrites(
                label,
                () => call(alice.token, method, path, body),
                (r) => {
                    assert.equal(r.status, status, `${label}: ${r.status} ${r.text}`);
                    if (error) assert.equal(r.json.error, error, label);
                }
            );
        const tx = { accountId: A.acc, title: 'xx', type: 'expense', amountMinor: 10, isFromSharedAccount: true, month: '2026-11' };
        await rejected('foreign categoryId', 'POST', '/api/transactions', { ...tx, categoryId: B.category }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('foreign paidByMemberId', 'POST', '/api/transactions', { ...tx, paidByMemberId: B.member }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('foreign recurrenceId', 'POST', '/api/transactions', { ...tx, recurrenceId: B.rec }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('unknown recurrenceId', 'POST', '/api/transactions', { ...tx, recurrenceId: String(new ObjectId()) }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('patch with foreign recurrence', 'PATCH', `/api/transactions/${A.tx}`, { recurrenceId: B.rec }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        // categories and recurrences: nothing can be moved between accounts or point at foreign objects
        await rejected('category: delete a category that is still referenced', 'DELETE', `/api/categories/${A.category}`, undefined, 409, 'CATEGORY_REFERENCED');
        await rejected('category: take over a foreign category by accountId', 'PATCH', `/api/categories/${B.category}`, { accountId: A.acc }, 404);
        await rejected('category: move an own category to a foreign account', 'PATCH', `/api/categories/${A.category}`, { accountId: B.acc }, 422, 'ACCOUNT_IMMUTABLE');
        await rejected('category: create in a foreign account', 'POST', '/api/categories', { accountId: B.acc, name: 'xx' }, 404);
        await rejected('category: customSplit with a foreign member (create)', 'POST', '/api/categories', { accountId: A.acc, name: 'xx', customSplit: [{ memberId: B.member, split: 100 }] }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('category: customSplit with a foreign member (patch)', 'PATCH', `/api/categories/${A.category}`, { customSplit: [{ memberId: B.partner, split: 100 }] }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('recurrence: take over a foreign recurrence by accountId', 'PATCH', `/api/recurrences/${B.rec}`, { accountId: A.acc }, 404);
        await rejected('recurrence: move an own recurrence to a foreign account', 'PATCH', `/api/recurrences/${A.rec}`, { accountId: B.acc }, 422, 'ACCOUNT_IMMUTABLE');
        await rejected('recurrence: create in a foreign account', 'POST', '/api/recurrences', { accountId: B.acc, type: 'expense', amountMinor: 1 }, 404);
        await rejected('recurrence: foreign category (create)', 'POST', '/api/recurrences', { accountId: A.acc, type: 'expense', amountMinor: 1, categoryId: B.category }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('recurrence: foreign member (create)', 'POST', '/api/recurrences', { accountId: A.acc, type: 'expense', amountMinor: 1, createdByMemberId: B.member }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('recurrence: foreign category (patch)', 'PATCH', `/api/recurrences/${A.rec}`, { categoryId: B.category }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('recurrence: foreign member (patch)', 'PATCH', `/api/recurrences/${A.rec}`, { createdByMemberId: B.partner }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('recurrence: validation error', 'POST', '/api/recurrences', { accountId: A.acc, type: 'nope' }, 400);
        await rejected('foreign parent in own account', 'POST', '/api/transactions', { ...tx, parentTransactionId: B.tx }, 422, 'PARENT_NOT_FOUND');
        await rejected('own parent in foreign account', 'POST', '/api/transactions', { ...tx, accountId: B.acc, parentTransactionId: A.tx }, 404);
        await rejected('patch with foreign category', 'PATCH', `/api/transactions/${A.tx}`, { categoryId: B.category }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('patch with foreign payer', 'PATCH', `/api/transactions/${A.child}`, { title: 'xx', paidByMemberId: B.member }, 422);
        await rejected('budget with foreign category', 'POST', '/api/category-budgets', { accountId: A.acc, categoryId: B.category, amountMinor: 1, fromMonth: '2027-02' }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('income for a foreign member', 'POST', '/api/member-incomes', { accountId: A.acc, memberId: B.member, amountMinor: 1, fromMonth: '2027-02' }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('carryover for a foreign member', 'PUT', '/api/carryovers', { accountId: A.acc, memberId: B.member, month: '2027-02', amountMinor: 1 }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected(
            'rule distribution with a foreign member',
            'POST',
            '/api/contribution-rules',
            { accountId: A.acc, type: 'additional', recurring: false, amountMinor: 1, distribution: { mode: 'perMember', memberId: B.member }, fromMonth: '2027-02' },
            422,
            'REFERENCE_NOT_IN_ACCOUNT'
        );
        await rejected(
            'rule custom split with a foreign member',
            'POST',
            '/api/contribution-rules',
            {
                accountId: A.acc,
                type: 'additional',
                recurring: false,
                amountMinor: 1,
                distribution: {
                    mode: 'customSplit',
                    customSplit: [
                        { memberId: A.member, split: 50 },
                        { memberId: B.member, split: 50 }
                    ]
                },
                fromMonth: '2027-02'
            },
            422,
            'REFERENCE_NOT_IN_ACCOUNT'
        );
        await rejected('rule createdByMemberId foreign', 'PATCH', `/api/contribution-rules/${A.rule}`, { createdByMemberId: B.member }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('foreign member added to an account', 'POST', `/api/accounts/${A.acc}/members`, { memberId: B.partner, role: 'member' }, 422, 'MEMBER_NOT_ASSIGNABLE');
        await rejected('validation error', 'POST', '/api/transactions', { accountId: A.acc, title: '' }, 400);
        await rejected('validation error on a foreign account', 'POST', '/api/transactions', { accountId: B.acc, title: '' }, 400);
        await rejected('malformed id', 'PATCH', '/api/transactions/not-an-id', { title: 'xx' }, 404);
    });

    await t.test('account creation: the creator is always an owner member; foreign or foreign-linked members are refused', async () => {
        const carol = await register('carol');
        const carolMember = (await call(carol.token, 'POST', '/api/members', { name: 'Carol', userId: carol.userId })).json;
        const other = (await call(carol.token, 'POST', '/api/members', { name: 'Other' })).json;
        const without = await call(carol.token, 'POST', '/api/accounts', { name: 'no creator', members: [{ memberId: other._id, role: 'owner' }] });
        assert.deepEqual([without.status, without.json.error], [422, 'CREATOR_MEMBER_REQUIRED']);
        assert.deepEqual([(await call(carol.token, 'POST', '/api/accounts', { name: 'empty' })).status], [422]);
        const impersonate = await call(carol.token, 'POST', '/api/accounts', { name: 'steal', members: [{ memberId: carolMember._id }, { memberId: B.member }] });
        assert.deepEqual([impersonate.status, impersonate.json.error], [422, 'MEMBER_NOT_ASSIGNABLE']);
        const pullUnlinked = await call(carol.token, 'POST', '/api/accounts', { name: 'pull', members: [{ memberId: carolMember._id }, { memberId: B.partner }] });
        assert.deepEqual([pullUnlinked.status, pullUnlinked.json.error], [422, 'MEMBER_NOT_ASSIGNABLE']);
        const created = await call(carol.token, 'POST', '/api/accounts', {
            name: 'ok',
            members: [
                { memberId: other._id, role: 'owner' },
                { memberId: carolMember._id, role: 'member' }
            ]
        });
        assert.equal(created.status, 201);
        assert.deepEqual(
            created.json.members.map((m) => [m.memberId, m.role]),
            [
                [other._id, 'owner'],
                [carolMember._id, 'owner']
            ]
        );
        assert.equal((await call(carol.token, 'GET', `/api/accounts/${created.json._id}`)).status, 200);
        assert.equal((await call(alice.token, 'GET', `/api/accounts/${created.json._id}`)).status, 404);
        // The caller cannot cut themselves out of the account.
        const lockout = await call(carol.token, 'PATCH', `/api/accounts/${created.json._id}`, { members: [{ memberId: other._id, role: 'owner' }] });
        assert.deepEqual([lockout.status, lockout.json.error], [409, 'CALLER_WOULD_LOSE_ACCESS']);
    });

    await t.test('members routes: no self-assignment to foreign members, no foreign e-mails, linked members cannot be deleted', async () => {
        await expectNoWrites(
            'link a new member to another user',
            () => call(alice.token, 'POST', '/api/members', { name: 'x', userId: bob.userId }),
            (r) => assert.deepEqual([r.status, r.json.error], [403, 'USER_LINK_FORBIDDEN'])
        );
        await expectNoWrites(
            'self-assign to an unlinked member of the own account',
            () => call(alice.token, 'PATCH', `/api/members/${A.partner}`, { userId: alice.userId }),
            (r) => assert.deepEqual([r.status, r.json.error], [403, 'USER_LINK_FORBIDDEN'])
        );
        await expectNoWrites(
            'take over a foreign member',
            () => call(alice.token, 'PATCH', `/api/members/${B.member}`, { userId: alice.userId }),
            (r) => assert.equal(r.status, 404)
        );
        await expectNoWrites(
            'rename a foreign member',
            () => call(alice.token, 'PATCH', `/api/members/${B.partner}`, { name: 'x' }),
            (r) => assert.equal(r.status, 404)
        );
        await expectNoWrites(
            'delete a foreign member',
            () => call(alice.token, 'DELETE', `/api/members/${B.partner}`),
            (r) => assert.equal(r.status, 404)
        );
        await expectNoWrites(
            'delete the own linked member',
            () => call(alice.token, 'DELETE', `/api/members/${A.member}`),
            (r) => assert.deepEqual([r.status, r.json.error], [409, 'MEMBER_LINKED'])
        );
        await expectNoWrites(
            'unlink the own member',
            () => call(alice.token, 'PATCH', `/api/members/${A.member}`, { userId: null }),
            (r) => assert.equal(r.status, 403)
        );
        await expectNoWrites(
            'remove the own member from the account (lock-out)',
            () => call(alice.token, 'DELETE', `/api/accounts/${A.acc}/members/${A.member}`),
            (r) => assert.deepEqual([r.status, r.json.error], [409, 'CALLER_WOULD_LOSE_ACCESS'])
        );
        await expectNoWrites(
            'delete a member that is still part of an account',
            () => call(alice.token, 'DELETE', `/api/members/${A.partner}`),
            (r) => assert.deepEqual([r.status, r.json.error], [409, 'MEMBER_IN_USE'])
        );
        const listed = await call(alice.token, 'GET', '/api/members');
        assert.equal(listed.status, 200);
        assert.deepEqual(new Set(listed.json.map((m) => m._id)).has(B.member) || new Set(listed.json.map((m) => m._id)).has(B.partner), false);
        assert.ok(!listed.text.includes('bob@example.test') && !listed.text.includes('bob-partner@example.test'));
        assert.ok(listed.json.some((m) => m._id === A.member) && listed.json.some((m) => m._id === A.partner));
        assert.deepEqual((await call(alice.token, 'GET', `/api/members?userId=${bob.userId}`)).json, []);
        assert.equal((await call(admin.token, 'GET', '/api/members')).json.length, 0);
        // Allowed: edit a visible member's name and e-mail, delete an unlinked member of the own account.
        assert.equal((await call(alice.token, 'PATCH', `/api/members/${A.partner}`, { name: 'Partner renamed', userId: null })).status, 200);
        const extra = (await call(alice.token, 'POST', '/api/members', { name: 'extra' })).json;
        assert.equal((await call(alice.token, 'POST', `/api/accounts/${A.acc}/members`, { memberId: extra._id, role: 'member' })).status, 200);
        assert.equal((await call(alice.token, 'DELETE', `/api/accounts/${A.acc}/members/${extra._id}`)).status, 200);
        // Removed from the account, the unlinked member is an orphan nobody can reach any more.
        assert.equal((await call(alice.token, 'DELETE', `/api/members/${extra._id}`)).status, 404);
    });

    await t.test('category-budgets: rejected requests (409 BUDGET_OVERLAP, 404, 422, 400) write nothing, not even accounts.updatedAt, and emit no event', async () => {
        const extra = await call(alice.token, 'POST', '/api/category-budgets', { accountId: A.acc, categoryId: A.category, amountMinor: 50, fromMonth: '2027-01', toMonth: '2027-02' });
        assert.equal(extra.status, 201, extra.text);
        const rejected = async (label, method, path, body, status, code) =>
            expectNoWrites(
                label,
                () => call(alice.token, method, path, body),
                (r) => {
                    assert.equal(r.status, status, `${label}: ${r.status} ${r.text}`);
                    if (code) assert.equal(r.json.code ?? r.json.error, code, label);
                }
            );
        await rejected('POST overlapping an existing budget', 'POST', '/api/category-budgets', { accountId: A.acc, categoryId: A.category, amountMinor: 1, fromMonth: '2026-12', toMonth: '2027-01' }, 409, 'BUDGET_OVERLAP');
        await rejected('PATCH into an overlap', 'PATCH', `/api/category-budgets/${extra.json._id}`, { fromMonth: '2026-12' }, 409, 'BUDGET_OVERLAP');
        await rejected('PATCH of an unknown budget', 'PATCH', `/api/category-budgets/${new ObjectId()}`, { amountMinor: 2 }, 404);
        await rejected('DELETE of an unknown budget', 'DELETE', `/api/category-budgets/${new ObjectId()}`, undefined, 404);
        await rejected('POST with a foreign category', 'POST', '/api/category-budgets', { accountId: A.acc, categoryId: B.category, amountMinor: 1, fromMonth: '2028-01' }, 422, 'REFERENCE_NOT_IN_ACCOUNT');
        await rejected('POST with invalid months', 'POST', '/api/category-budgets', { accountId: A.acc, categoryId: A.category, amountMinor: 1, fromMonth: '2028-13' }, 400);
        // An accepted write still changes exactly what it should.
        const before = await snapshot();
        assert.equal((await call(alice.token, 'PATCH', `/api/category-budgets/${extra.json._id}`, { amountMinor: 60 })).status, 200);
        assert.notDeepEqual(await snapshot(), before);
    });

    await t.test('summary: GET /api/accounts/summary lists only the caller’s accounts; 401 without a token', async () => {
        const ids = async (who) => (await call(who.token, 'GET', '/api/accounts/summary')).json.map((s) => s.id);
        assert.deepEqual(await ids(alice), [A.acc]);
        assert.deepEqual(await ids(bob), [B.acc]);
        assert.deepEqual(await ids(admin), []);
        assert.equal((await call(undefined, 'GET', '/api/accounts/summary')).status, 401);
        assert.equal((await call('invalid', 'GET', '/api/accounts/summary')).status, 401);
        const all = JSON.stringify(await call(alice.token, 'GET', '/api/accounts/summary'));
        assert.ok(!all.includes(B.acc) && !all.includes(L.acc));
    });

    await t.test('summary and the quoted foreign data stay untouched by all of the above', async () => {
        const summary = (await call(bob.token, 'GET', '/api/accounts/summary')).json;
        assert.deepEqual(
            summary.map((s) => s.id),
            [B.acc]
        );
        assert.equal(await db.collection('transactions').countDocuments({ accountId: new ObjectId(B.acc) }), 2);
        assert.equal(await db.collection('transactions').countDocuments({ accountId: legacyAccount }), 1);
    });
});
