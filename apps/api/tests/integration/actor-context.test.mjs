import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from 'mongoose';
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

test('E02 actor/account context: real JWT, HTTP and Mongo (owner, member, stranger, admin, unregistered member, forgery)', { timeout: 300000 }, async (t) => {
    const endpoint = process.env.TEST_MONGODB_URI;
    assert.ok(endpoint, 'Provide TEST_MONGODB_URI for a dedicated replica-set test server (npm run test:integration)');
    const parsed = new URL(endpoint);
    assert.equal(parsed.protocol, 'mongodb:');
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Only local test servers are accepted');
    const dbName = `tobu_test_${randomUUID().replaceAll('-', '')}`;
    parsed.pathname = `/${dbName}`;
    const uri = parsed.toString();
    const scratch = await mkdtemp(join(resolve(tmpdir()), 'tobu-actor-test-'));
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    let api;
    let apiOutput = '';
    t.after(async () => {
        try {
            await mongoose.disconnect().catch(() => {});
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

    const call = async (token, method, path, body, headers = {}) => {
        const response = await fetch(base + path, {
            method,
            signal: AbortSignal.timeout(15000),
            headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: ['Bearer', token].join(' ') } : {}), ...headers },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const text = await response.text();
        return { status: response.status, text, json: text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : undefined };
    };
    const db = client.db(dbName);
    // Everything except authentication data: a write or an event by a rejected request shows up here.
    const snapshot = async () => {
        const out = {};
        for (const { name } of await db.listCollections().toArray()) {
            if (name.startsWith('_tobu') || name === 'users' || name === 'auth_sessions' || name.startsWith('system.')) continue;
            out[name] = JSON.stringify(await db.collection(name).find({}).sort({ _id: 1 }).toArray());
        }
        return out;
    };
    const events = (accountId) =>
        db
            .collection('events')
            .find({ accountId: new ObjectId(accountId) })
            .sort({ _id: 1 })
            .toArray();
    const register = async (name) => {
        const reg = await call(undefined, 'POST', '/api/auth/register', { email: `${name}@example.test`, password: `${name}-test-password`, name });
        assert.equal(reg.status, 201);
        return { name, token: reg.json.accessToken, userId: reg.json.user.id, email: `${name}@example.test`, password: `${name}-test-password` };
    };
    const [alice, bob, carol, dave, admin] = [await register('alice'), await register('bob'), await register('carol'), await register('dave'), await register('admin')];
    await db.collection('users').updateOne({ _id: new ObjectId(admin.userId) }, { $set: { roles: ['admin', 'user'] } });
    const adminLogin = await call(undefined, 'POST', '/api/auth/login', { email: admin.email, password: admin.password });
    assert.ok(adminLogin.json.user.roles.includes('admin'));
    admin.token = adminLogin.json.accessToken;

    // Fixture through the public API; there is no invitation flow, so bob's membership is inserted directly (as an invite would).
    const linkedMember = async (who, label) => (await call(who.token, 'POST', '/api/members', { name: `${who.name} ${label}`, email: who.email, userId: who.userId })).json;
    const aliceMember = await linkedMember(alice, 'member');
    const bobMember = await linkedMember(bob, 'member');
    const carolMember = await linkedMember(carol, 'member');
    const ghost = (await call(alice.token, 'POST', '/api/members', { name: 'Ghost (unregistered)' })).json;
    const spare = (await call(alice.token, 'POST', '/api/members', { name: 'Spare (unregistered)' })).json;
    assert.equal(ghost.userId ?? null, null);
    const accountA = (await call(alice.token, 'POST', '/api/accounts', { name: 'A', members: [{ memberId: aliceMember._id }, { memberId: ghost._id }] })).json._id;
    const accountC = (await call(carol.token, 'POST', '/api/accounts', { name: 'C', members: [{ memberId: carolMember._id }] })).json._id;
    await db.collection('accounts').updateOne({ _id: new ObjectId(accountA) }, { $push: { members: { memberId: new ObjectId(bobMember._id), role: 'member' } } });
    const roleOf = async (memberId) => (await db.collection('accounts').findOne({ _id: new ObjectId(accountA) })).members.find((m) => String(m.memberId) === memberId)?.role;
    assert.equal(await roleOf(aliceMember._id), 'owner', 'creator is owner');
    assert.equal(await roleOf(bobMember._id), 'member');
    const category = (await call(alice.token, 'POST', '/api/categories', { accountId: accountA, name: 'Food' })).json;
    assert.ok(category._id);

    await t.test('context resolution on the real database: actor, role and account are derived from JWT sub -> Member.userId -> Account.members', async () => {
        await mongoose.connect(uri);
        const { resolveAccountContext, requireOwnerContext } = await import(pathToFileURL(join(root, 'dist/src/auth/account-context.js')).href);
        const asUser = (sub) => ({ user: { sub, roles: ['admin', 'owner'] } });
        const owner = await resolveAccountContext(asUser(alice.userId), accountA);
        assert.deepEqual({ ...owner.actor }, { kind: 'user', userId: alice.userId });
        assert.deepEqual({ ...owner.account }, { accountId: accountA, memberId: aliceMember._id, role: 'owner' });
        const member = await resolveAccountContext(asUser(bob.userId), accountA);
        assert.deepEqual({ ...member.account }, { accountId: accountA, memberId: bobMember._id, role: 'member' }, 'role comes from Account.members, never from token claims');
        assert.equal(member.account.memberId === ghost._id, false);
        assert.ok(Object.isFrozen(owner) && Object.isFrozen(owner.actor) && Object.isFrozen(owner.account), 'context is immutable');
        const viaObjectId = await resolveAccountContext(asUser(alice.userId), new mongoose.Types.ObjectId(accountA));
        assert.equal(viaObjectId.account.accountId, accountA);
        for (const [label, who, account] of [
            ['stranger on foreign account', carol.userId, accountA],
            ['user without any member', dave.userId, accountA],
            ['global admin without membership', admin.userId, accountA],
            ['member of another account', bob.userId, accountC],
            ['unknown account', alice.userId, new ObjectId().toHexString()],
            ['malformed account', alice.userId, 'nope'],
            ['malformed subject', 'not-an-id', accountA],
            ['missing user', undefined, accountA]
        ]) {
            assert.equal(await resolveAccountContext(asUser(who), account), null, label);
        }
        assert.equal(await resolveAccountContext({}, accountA), null, 'no authenticated user');
        // An unregistered member (userId null) is a payer/subject only: no user id resolves to it.
        const linkedToGhost = await mongoose.connection.db.collection('members').countDocuments({ _id: new ObjectId(ghost._id), userId: { $ne: null } });
        assert.equal(linkedToGhost, 0);
        // A user linked twice in one account counts as owner when one of the linked entries is owner.
        const second = (await call(alice.token, 'POST', '/api/members', { name: 'Alice second', userId: alice.userId })).json;
        await db.collection('accounts').updateOne({ _id: new ObjectId(accountA) }, { $push: { members: { memberId: new ObjectId(second._id), role: 'member' } } });
        assert.equal((await resolveAccountContext(asUser(alice.userId), accountA)).account.role, 'owner', 'owner entry wins');
        await db.collection('accounts').updateOne({ _id: new ObjectId(accountA) }, { $pull: { members: { memberId: new ObjectId(second._id) } } });
        // Any member linked to the user grants membership, none linked to another user does.
        await db.collection('accounts').updateOne({ _id: new ObjectId(accountC) }, { $push: { members: { memberId: new ObjectId(second._id), role: 'member' } } });
        assert.equal((await resolveAccountContext(asUser(alice.userId), accountC)).account.role, 'member');
        await db.collection('accounts').updateOne({ _id: new ObjectId(accountC) }, { $pull: { members: { memberId: new ObjectId(second._id) } } });
        assert.equal(await resolveAccountContext(asUser(alice.userId), accountC), null);
        let status;
        const res = { sendStatus: (s) => (status = s), status: (s) => ({ json: (b) => (status = [s, b]) }) };
        assert.equal(await requireOwnerContext(asUser(bob.userId), res, accountA), null);
        assert.deepEqual(status, [403, { error: 'OWNER_REQUIRED' }]);
        assert.equal(await requireOwnerContext(asUser(carol.userId), res, accountA), null);
        assert.equal(status, 404, 'a non-member never learns that the account exists');
    });

    await t.test('read: owner and member 200, everybody else 404 without a body; 401 for missing or wrong tokens', async () => {
        const paths = [`/api/accounts/${accountA}/overview`, `/api/accounts/${accountA}/month-view?month=2026-11`, `/api/accounts/${accountA}`, `/api/transactions?accountId=${accountA}`];
        for (const path of paths) {
            assert.equal((await call(alice.token, 'GET', path)).status, 200, `owner ${path}`);
            assert.equal((await call(bob.token, 'GET', path)).status, 200, `member ${path}`);
            for (const who of [carol, dave, admin]) {
                const response = await call(who.token, 'GET', path);
                assert.equal(response.status, 404, `${who.name} ${path}`);
                assert.equal(response.text.includes('A'), false, 'no body that could leak the account');
            }
            assert.equal((await call(undefined, 'GET', path)).status, 401, `no token ${path}`);
            assert.equal((await call('garbage.token.value', 'GET', path)).status, 401, `bad token ${path}`);
        }
        const login = await call(undefined, 'POST', '/api/auth/login', { email: alice.email, password: alice.password });
        assert.equal(login.status, 200);
        const futureActivity = `/api/accounts/${accountA}/activity`;
        assert.equal((await call(undefined, 'GET', futureActivity)).status, 401, 'the future activity route is behind authentication already');
        assert.equal((await call(carol.token, 'GET', futureActivity)).status, 404);
        const listForAdmin = await call(admin.token, 'GET', '/api/accounts');
        assert.deepEqual(listForAdmin.json, [], 'global admin sees no accounts without membership');
        assert.deepEqual(
            (await call(carol.token, 'GET', '/api/accounts')).json.map((a) => a._id),
            [accountC]
        );
        const summary = await call(admin.token, 'GET', '/api/accounts/summary');
        assert.deepEqual(summary.json, []);
    });

    await t.test('header and body forgery never changes the actor or grants access; nothing is written on rejection', async () => {
        const forged = { 'x-user-id': alice.userId, 'x-actor-user-id': alice.userId, 'x-account-role': 'owner', 'x-forwarded-user': alice.email, 'x-roles': 'admin,owner' };
        const before = await snapshot();
        for (const [method, path, body] of [
            ['GET', `/api/accounts/${accountA}/overview`],
            ['POST', `/api/accounts/${accountA}/members`, { memberId: spare._id, role: 'member' }],
            ['DELETE', `/api/accounts/${accountA}/members/${bobMember._id}`],
            ['PATCH', `/api/accounts/${accountA}`, { name: 'taken over' }],
            ['POST', '/api/transactions', { accountId: accountA, title: 'forged', type: 'expense', amountMinor: 1, isFromSharedAccount: true, month: '2026-11' }]
        ]) {
            const response = await call(carol.token, method, path, body, forged);
            assert.equal(response.status, 404, `${method} ${path}`);
        }
        const bodyForgery = {
            actorUserId: alice.userId,
            actorKind: 'system',
            actor: { kind: 'user', userId: alice.userId },
            trigger: { kind: 'automation' },
            subject: { kind: 'account', id: accountA },
            createdByMemberId: aliceMember._id,
            userId: alice.userId,
            role: 'owner',
            roles: ['admin']
        };
        for (const [method, path] of [
            ['POST', '/api/transactions'],
            ['POST', '/api/categories'],
            ['PUT', '/api/account-balances']
        ]) {
            const response = await call(
                carol.token,
                method,
                path,
                path.includes('categories')
                    ? { accountId: accountA, name: 'x', ...bodyForgery }
                    : path.includes('balances')
                      ? { accountId: accountA, month: '2026-11', closingBalanceMinor: 1, ...bodyForgery }
                      : { accountId: accountA, title: 'forged', type: 'expense', amountMinor: 1, isFromSharedAccount: true, month: '2026-11', ...bodyForgery }
            );
            assert.equal(response.status, 404, `${method} ${path} into a foreign account`);
        }
        assert.deepEqual(await snapshot(), before, 'rejected requests changed data or events');

        // Accepted write by the real owner: unknown forgery fields are ignored and never stored on the document or in the event.
        const created = await call(alice.token, 'POST', '/api/transactions', { accountId: accountA, title: 'real', type: 'expense', amountMinor: 700, isFromSharedAccount: true, month: '2026-11', ...bodyForgery, createdByMemberId: undefined });
        assert.equal(created.status, 201, created.text);
        const stored = await db.collection('transactions').findOne({ _id: new ObjectId(created.json._id) });
        for (const key of ['actorUserId', 'actorKind', 'actor', 'trigger', 'subject', 'userId', 'role', 'roles']) assert.equal(key in stored, false, `forged ${key} is not persisted`);
        const written = (await events(accountA)).filter((e) => e.params?.transactionId === created.json._id);
        assert.equal(written.length, 1);
        for (const key of ['actorUserId', 'actorKind', 'actor', 'trigger', 'subject', 'userId']) assert.equal(key in written[0] || key in written[0].params, false, `forged ${key} not in the event`);
        assert.equal(written[0].schemaVersion, undefined, 'the persisted event model is unchanged by E02');
    });

    await t.test('payer is not the actor: a member books for another member and for an unregistered member', async () => {
        const forOwner = await call(bob.token, 'POST', '/api/transactions', {
            accountId: accountA,
            title: 'bob pays alice',
            type: 'expense',
            amountMinor: 500,
            isFromSharedAccount: false,
            paidByMemberId: aliceMember._id,
            month: '2026-11',
            status: 'pending'
        });
        assert.equal(forOwner.status, 201, forOwner.text);
        const forGhost = await call(alice.token, 'POST', '/api/transactions', {
            accountId: accountA,
            title: 'ghost pays',
            type: 'expense',
            amountMinor: 300,
            isFromSharedAccount: false,
            paidByMemberId: ghost._id,
            month: '2026-11',
            status: 'pending'
        });
        assert.equal(forGhost.status, 201, forGhost.text);
        const toForeign = await call(bob.token, 'POST', '/api/transactions', {
            accountId: accountA,
            title: 'foreign payer',
            type: 'expense',
            amountMinor: 1,
            isFromSharedAccount: false,
            paidByMemberId: carolMember._id,
            month: '2026-11',
            status: 'pending'
        });
        assert.equal(toForeign.status, 422, 'a member of another account can be neither payer nor subject here');
        // Characterization of the current writers (known gap for E04/E05): the event stores the payer, not the acting user.
        const [payerEvent] = (await events(accountA)).filter((e) => e.params?.transactionId === forOwner.json._id);
        assert.equal(String(payerEvent.createdByMemberId), aliceMember._id, 'createdByMemberId is the payer (alice), the actor was bob');
        assert.equal(payerEvent.actor, undefined, 'no actor is persisted before E04');
    });

    await t.test('owner-only: membership and role changes; members, strangers and admin are rejected with 0 writes and 0 events', async () => {
        const memberAttempts = [
            ['add member', 'POST', `/api/accounts/${accountA}/members`, { memberId: spare._id, role: 'member' }],
            ['remove member', 'DELETE', `/api/accounts/${accountA}/members/${ghost._id}`],
            ['remove co-member', 'DELETE', `/api/accounts/${accountA}/members/${aliceMember._id}`],
            [
                'self-promotion via members array',
                'PATCH',
                `/api/accounts/${accountA}`,
                {
                    members: [
                        { memberId: aliceMember._id, role: 'owner' },
                        { memberId: bobMember._id, role: 'owner' },
                        { memberId: ghost._id, role: 'member' }
                    ]
                }
            ],
            [
                'demote owner via members array',
                'PATCH',
                `/api/accounts/${accountA}`,
                {
                    members: [
                        { memberId: aliceMember._id, role: 'member' },
                        { memberId: bobMember._id, role: 'owner' }
                    ]
                }
            ],
            ['role change through add', 'POST', `/api/accounts/${accountA}/members`, { memberId: bobMember._id, role: 'owner' }]
        ];
        const before = await snapshot();
        for (const [label, method, path, body] of memberAttempts) {
            const asMember = await call(bob.token, method, path, body);
            assert.equal(asMember.status, 403, `member: ${label}`);
            assert.deepEqual(asMember.json, { error: 'OWNER_REQUIRED' });
            for (const who of [carol, dave, admin]) assert.equal((await call(who.token, method, path, body)).status, 404, `${who.name}: ${label}`);
            assert.equal((await call(undefined, method, path, body)).status, 401, `anonymous: ${label}`);
        }
        assert.deepEqual(await snapshot(), before, 'rejected membership requests changed data or events');
        assert.equal(await roleOf(bobMember._id), 'member');

        // Owner decision 04.11.2026: account settings are owner-only, finance data is equal for owner and member.
        const settingsBefore = await snapshot();
        const renamed = await call(bob.token, 'PATCH', `/api/accounts/${accountA}`, { name: 'A (renamed by member)' });
        assert.equal(renamed.status, 403);
        assert.deepEqual(renamed.json, { error: 'OWNER_REQUIRED' });
        for (const who of [carol, dave, admin]) assert.equal((await call(who.token, 'PATCH', `/api/accounts/${accountA}`, { name: 'x' })).status, 404, who.name);
        assert.deepEqual(await snapshot(), settingsBefore, 'rejected settings changes wrote nothing');
        assert.equal((await call(alice.token, 'PATCH', `/api/accounts/${accountA}`, { name: 'A (renamed by owner)' })).status, 200);
        const memberCategory = await call(bob.token, 'POST', '/api/categories', { accountId: accountA, name: 'Created by member' });
        assert.equal(memberCategory.status, 201, '§61.4: registered members may create categories');
        assert.equal((await call(bob.token, 'PATCH', `/api/categories/${memberCategory.json._id}`, { name: 'Edited by member' })).status, 200, 'members edit categories');
        assert.equal((await call(bob.token, 'DELETE', `/api/categories/${memberCategory.json._id}`)).status, 204, 'members delete unused categories');
        const used = await call(alice.token, 'POST', '/api/transactions', { accountId: accountA, title: 'uses food', type: 'expense', amountMinor: 100, isFromSharedAccount: true, month: '2026-11', categoryId: category._id });
        assert.equal(used.status, 201, used.text);
        const usedDelete = await call(bob.token, 'DELETE', `/api/categories/${category._id}`);
        assert.equal(usedDelete.status, 409, 'a used category cannot be deleted by anyone');
        assert.equal(usedDelete.json.error, 'CATEGORY_REFERENCED');
        for (const [method, path, body] of [
            ['POST', '/api/member-incomes', { accountId: accountA, memberId: aliceMember._id, amountMinor: 100, fromMonth: '2026-11', toMonth: '2026-11' }],
            ['PUT', '/api/carryovers', { accountId: accountA, memberId: aliceMember._id, month: '2026-11', amountMinor: 5 }],
            ['POST', '/api/category-budgets', { accountId: accountA, categoryId: category._id, amountMinor: 500, fromMonth: '2026-11', toMonth: '2026-11' }],
            [
                'POST',
                '/api/contribution-rules',
                {
                    accountId: accountA,
                    type: 'additional',
                    amountMinor: 100,
                    recurring: false,
                    fromMonth: '2026-11',
                    distribution: { mode: 'perMember', memberId: aliceMember._id }
                }
            ]
        ]) {
            const response = await call(bob.token, method, path, body);
            assert.ok([200, 201, 422].includes(response.status), `${method} ${path} is member-level (got ${response.status}: ${response.text.slice(0, 120)})`);
            assert.notEqual(response.status, 403);
            assert.notEqual(response.status, 404);
        }

        // The owner may do all of it, once, with one event per change.
        const guardBefore = await snapshot();
        const lastOwner = await call(alice.token, 'POST', `/api/accounts/${accountA}/members`, { memberId: aliceMember._id, role: 'member' });
        assert.equal(lastOwner.status, 409);
        assert.equal(lastOwner.json.error, 'LAST_OWNER', 'the only owner cannot be demoted through POST members');
        const referenced = await call(alice.token, 'PATCH', `/api/accounts/${accountA}`, {
            members: [
                { memberId: aliceMember._id, role: 'owner' },
                { memberId: bobMember._id, role: 'member' }
            ]
        });
        assert.equal(referenced.status, 409);
        assert.equal(referenced.json.error, 'MEMBER_REFERENCED', 'PATCH members cannot drop a payer that DELETE would protect');
        assert.deepEqual(await snapshot(), guardBefore, 'refused owner actions wrote nothing');
        const eventsBefore = (await events(accountA)).length;
        assert.equal((await call(alice.token, 'POST', `/api/accounts/${accountA}/members`, { memberId: spare._id, role: 'member' })).status, 200);
        assert.equal((await call(alice.token, 'DELETE', `/api/accounts/${accountA}/members/${spare._id}`)).status, 200);
        assert.equal((await events(accountA)).length, eventsBefore + 2);
        assert.equal((await call(alice.token, 'POST', `/api/accounts/${accountA}/members`, { memberId: bobMember._id, role: 'owner' })).status, 200);
        assert.equal(await roleOf(bobMember._id), 'owner', 'owner promoted bob');
        // The role is read from the database on every request: bob is now owner, no new token needed.
        assert.equal((await call(bob.token, 'POST', `/api/accounts/${accountA}/members`, { memberId: spare._id, role: 'member' })).status, 200);
        assert.equal((await call(bob.token, 'DELETE', `/api/accounts/${accountA}/members/${spare._id}`)).status, 200);
        await db.collection('accounts').updateOne({ _id: new ObjectId(accountA), 'members.memberId': new ObjectId(bobMember._id) }, { $set: { 'members.$.role': 'member' } });
        assert.equal((await call(bob.token, 'POST', `/api/accounts/${accountA}/members`, { memberId: spare._id, role: 'member' })).status, 403, 'demotion applies immediately to an existing token');
        // Cross-account owner (carol owns C) has no power in A.
        assert.equal((await call(carol.token, 'POST', `/api/accounts/${accountA}/members`, { memberId: spare._id, role: 'owner' })).status, 404);
    });

    await t.test('tokens: tampered, expired, alg none, algorithm confusion and refresh tokens never authenticate', async () => {
        const { default: jwt } = await import('jsonwebtoken');
        const path = `/api/accounts/${accountA}/overview`;
        const good = await call(alice.token, 'GET', path);
        assert.equal(good.status, 200);
        const [head, payload, signature] = alice.token.split('.');
        const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), sub: carol.userId })).toString('base64url');
        const refresh = (await call(undefined, 'POST', '/api/auth/login', { email: alice.email, password: alice.password })).json;
        const candidates = {
            'tampered payload (sub swapped)': [head, forgedPayload, signature].join('.'),
            'tampered signature': [head, payload, signature.slice(0, -4) + (signature.endsWith('AAAA') ? 'BBBB' : 'AAAA')].join('.'),
            expired: jwt.sign({ sub: alice.userId, type: 'access' }, env.JWT_ACCESS_PRIVATE_KEY_PEM, { algorithm: 'RS256', expiresIn: -60 }),
            'alg none': jwt.sign({ sub: alice.userId, type: 'access' }, '', { algorithm: 'none' }),
            'hs256 with the public key as secret': jwt.sign({ sub: alice.userId, type: 'access' }, env.JWT_ACCESS_PUBLIC_KEY_PEM, { algorithm: 'HS256' }),
            'signed with another RSA key': jwt.sign(
                { sub: alice.userId, type: 'access' },
                generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey,
                { algorithm: 'RS256', expiresIn: 60 }
            ),
            'refresh-signed token as bearer': jwt.sign({ sub: alice.userId, type: 'access' }, env.JWT_REFRESH_PRIVATE_KEY_PEM, { algorithm: 'RS256', expiresIn: 60 }),
            'empty bearer': ''
        };
        assert.ok(refresh.accessToken);
        const before = await snapshot();
        for (const [label, token] of Object.entries(candidates)) {
            for (const [method, p, body] of [
                ['GET', path],
                ['POST', `/api/accounts/${accountA}/members`, { memberId: spare._id, role: 'member' }]
            ]) {
                assert.equal((await call(token || undefined, method, p, body)).status, 401, `${label}: ${method} ${p}`);
            }
        }
        assert.deepEqual(await snapshot(), before);
        // Owner decision 04.11.2026: blocked or deleted users lose access at once, even with a still valid token; nothing is written.
        const blockedBefore = await snapshot();
        await db.collection('users').updateOne({ _id: new ObjectId(alice.userId) }, { $set: { isActive: false } });
        for (const [method, p, body] of [
            ['GET', path],
            ['POST', `/api/accounts/${accountA}/members`, { memberId: spare._id, role: 'member' }],
            ['POST', '/api/transactions', { accountId: accountA, title: 'blocked write', type: 'expense', amountMinor: 1, isFromSharedAccount: true, month: '2026-11' }]
        ]) {
            assert.equal((await call(alice.token, method, p, body)).status, 401, `blocked user: ${method} ${p}`);
        }
        assert.deepEqual(await snapshot(), blockedBefore, 'a blocked user changed data or events');
        assert.equal((await call(undefined, 'POST', '/api/auth/login', { email: alice.email, password: alice.password })).status, 401, 'blocked users cannot log in either');
        // Refresh path: a blocked user cannot rotate a session, and all of the user's sessions are revoked for good.
        await db.collection('users').updateOne({ _id: new ObjectId(alice.userId) }, { $set: { isActive: true } });
        const loginResponse = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: alice.email, password: alice.password }) });
        const refreshCookie = loginResponse.headers
            .getSetCookie()
            .map((c) => c.split(';')[0])
            .find((c) => c.startsWith('rt=') && c.length > 8);
        assert.ok(refreshCookie && refreshCookie.length > 8, `login sets the refresh cookie (login ${loginResponse.status}: ${refreshCookie})`);
        const refreshCall = () =>
            new Promise((resolveCall, rejectCall) => {
                // fetch silently drops a manual Cookie header; use http directly.
                const request = httpRequest(`${base}/api/auth/refresh`, { method: 'POST', headers: { cookie: refreshCookie } }, (response) => {
                    let text = '';
                    response.on('data', (chunk) => (text += chunk));
                    response.on('end', () => resolveCall({ status: response.statusCode, text: async () => text, clone: () => ({ text: async () => text }) }));
                });
                request.on('error', rejectCall);
                request.end();
            });
        await db.collection('users').updateOne({ _id: new ObjectId(alice.userId) }, { $set: { isActive: false } });
        const refreshed = await refreshCall();
        assert.equal(refreshed.status, 401, `blocked user cannot refresh: ${await refreshed.clone().text()}`);
        const refreshText = await refreshed.text();
        assert.equal(
            await db.collection('auth_sessions').countDocuments({ userId: new ObjectId(alice.userId), revokedAt: null }),
            0,
            `all sessions of the blocked user are revoked (${refreshText}; ${JSON.stringify(await db.collection('auth_sessions').findOne({ userId: new ObjectId(alice.userId) }))})`
        );
        assert.match(refreshText, /User inactive/, 'rejected because the user is inactive, not for another reason');
        await db.collection('users').updateOne({ _id: new ObjectId(alice.userId) }, { $set: { isActive: true } });
        assert.equal((await refreshCall()).status, 401, 'the old refresh session stays dead after unblocking');
        assert.equal((await call(undefined, 'POST', '/api/auth/login', { email: alice.email, password: alice.password })).status, 200, 'a fresh login works after unblocking');
        await db.collection('users').updateOne({ _id: new ObjectId(alice.userId) }, { $set: { isActive: true } });
        assert.equal((await call(alice.token, 'GET', path)).status, 200, 'unblocking restores access without a new token');
        const erin = await register('erin');
        assert.equal((await call(erin.token, 'GET', '/api/accounts')).status, 200);
        await db.collection('users').deleteOne({ _id: new ObjectId(erin.userId) });
        assert.equal((await call(erin.token, 'GET', '/api/accounts')).status, 401, 'a deleted user keeps no access');
        // Roles are read from the database, not from the token claim: a revoked admin role has no effect on account access either way.
        await db.collection('users').updateOne({ _id: new ObjectId(admin.userId) }, { $set: { isActive: false } });
        assert.equal((await call(admin.token, 'GET', '/api/accounts')).status, 401);
        await db.collection('users').updateOne({ _id: new ObjectId(admin.userId) }, { $set: { isActive: true } });
    });

    await t.test('owner-less legacy account and creator ambiguity stay blocked instead of guessing an owner', async () => {
        const legacyMember = new ObjectId();
        const legacy = new ObjectId();
        await db.collection('members').insertOne({ _id: legacyMember, name: 'Legacy', email: null, userId: null, createdAt: new Date(), updatedAt: new Date(), __v: 0 });
        await db.collection('accounts').insertOne({ _id: legacy, name: 'Legacy', currency: 'EUR', members: [{ memberId: legacyMember, role: 'owner' }] });
        const before = await snapshot();
        for (const who of [alice, bob, carol, admin]) {
            assert.equal((await call(who.token, 'GET', `/api/accounts/${legacy}/overview`)).status, 404, `${who.name} legacy read`);
            assert.equal((await call(who.token, 'POST', `/api/accounts/${legacy}/members`, { memberId: spare._id, role: 'member' })).status, 404, `${who.name} legacy member write`);
        }
        const noCreator = await call(dave.token, 'POST', '/api/accounts', { name: 'no creator', members: [{ memberId: ghost._id, role: 'owner' }] });
        assert.ok([403, 422].includes(noCreator.status), `creator without linked member is refused (${noCreator.status})`);
        assert.equal(noCreator.json?.error === 'CREATOR_MEMBER_REQUIRED' || noCreator.json?.error === 'MEMBER_NOT_ASSIGNABLE', true, noCreator.text);
        const wrongOwner = await call(dave.token, 'POST', '/api/accounts', { name: 'steals', members: [{ memberId: aliceMember._id, role: 'owner' }] });
        assert.equal(wrongOwner.status, 422, 'a member linked to another user can never be taken over');
        assert.deepEqual(await snapshot(), before);
    });
});
