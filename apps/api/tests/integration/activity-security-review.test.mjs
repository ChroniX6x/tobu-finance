import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId, BSON, MongoClient } from 'mongodb';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DateTime } from 'luxon';
import { activityStack } from '../fixtures/activity-stack.mjs';
import { temporaryDatabase } from '../../../../scripts/lib/docker.mjs';
import { ToolsBackup } from '../../dist/src/database/migration-backup.js';

test('E08 independent reviewer real Mongo JWT HTTP negatives', { timeout: 300000 }, async (t) => {
    const { db, call, register, snapshot, expectCall } = await activityStack(t);
    const owner = await register('reviewerowner'),
        outsider = await register('revieweroutsider');
    const account = await expectCall(owner, 'POST', '/api/accounts', { name: 'Reviewer isolated account' }, 201);
    const other = await expectCall(outsider, 'POST', '/api/accounts', { name: 'Other isolated account' }, 201);
    const path = `/api/accounts/${account._id}/activity`;
    await db.collection('users').updateOne({ _id: new ObjectId(outsider.userId) }, { $set: { roles: ['admin'] } });
    const login = await expectCall(undefined, 'POST', '/api/auth/login', { email: outsider.email, password: outsider.password });
    outsider.token = login.accessToken;
    const report = { assertions: [], readback: {} };
    report.fixture = { database: db.databaseName, serverVersion: (await db.admin().command({ buildInfo: 1 })).version, replicaSet: (await db.admin().command({ hello: 1 })).setName };
    await t.test('JWT ACL, admin has no implied membership, query rejection is write-free', async () => {
        const before = await snapshot();
        for (const route of [path, `/api/accounts/${account._id}/overview`]) {
            assert.equal((await call(undefined, 'GET', route)).status, 401);
            const denied = await call(outsider.token, 'GET', route);
            const missing = await call(outsider.token, 'GET', route.replace(account._id, String(new ObjectId())));
            assert.equal(denied.status, 404);
            assert.equal(denied.text, missing.text);
        }
        for (const query of ['?limit=0', '?limit=101', '?actorKind=admin', '?actorKind[$ne]=user', '?subjectId=000', '?cursor=forged', '?from=2026-11-08T12:00:00Z&to=2026-11-08T11:00:00Z'])
            assert.equal((await call(owner.token, 'GET', path + query)).status, 422, query);
        assert.deepEqual(await snapshot(), before);
        report.assertions.push('401/404 uniform; admin isolation; seven malformed queries; zero BSON writes');
    });
    await t.test('raw validator denies actor, trigger, subject, PII and new code drift; no TTL', async () => {
        const c = db.collection('events');
        const original = await c.findOne({ accountId: new ObjectId(account._id), code: 'account.created' });
        assert.ok(original);
        const changes = [
            { actor: { kind: 'legacy_unknown' } },
            { actor: { kind: 'system', userId: owner.userId } },
            { trigger: { kind: 'automation' } },
            { subject: { kind: 'category', id: account._id } },
            { params: { notes: 'PRIVATE', token: 'secret' } },
            { code: 'invented.code' },
            { schemaVersion: 2 },
            { occurredAt: new Date() }
        ];
        const before = await c.countDocuments({});
        for (const delta of changes) await assert.rejects(c.insertOne({ ...original, ...delta, _id: new ObjectId() }), (e) => e.code === 121);
        assert.equal(await c.countDocuments({}), before);
        await c.insertMany(Array.from({ length: 22 }, () => ({ ...original, _id: new ObjectId() })));
        const options = (await db.listCollections({ name: 'events' }).toArray())[0].options;
        const indexes = await c.listIndexes().toArray();
        assert.equal(options.validationLevel ?? 'strict', 'strict');
        assert.equal(options.validationAction ?? 'error', 'error');
        assert.ok(indexes.some((i) => i.name === 'accountId_1_date_-1__id_-1'));
        assert.deepEqual(
            Object.entries(indexes.find((i) => i.name === 'accountId_1_date_-1__id_-1').key),
            [
                ['accountId', 1],
                ['date', -1],
                ['_id', -1]
            ],
            'actual keyset index order and directions'
        );
        assert.ok(indexes.every((i) => i.expireAfterSeconds === undefined));
        report.readback = { options, indexes };
        report.assertions.push('eight raw BSON validation failures 121; strict/error validator; keyset index; zero event TTL');
    });
    await t.test('real signed cursor cannot move into another account or filter', async () => {
        const before = await snapshot();
        const first = await expectCall(owner, 'GET', path);
        assert.equal(first.items.length, 20);
        assert.ok(first.nextCursor);
        const second = await expectCall(owner, 'GET', path + '?cursor=' + encodeURIComponent(first.nextCursor));
        assert.equal(new Set([...first.items, ...second.items].map((e) => e.id)).size, 23);
        assert.equal((await call(owner.token, 'GET', path + '?limit=100&cursor=' + encodeURIComponent(first.nextCursor))).status, 422);
        assert.equal((await call(outsider.token, 'GET', `/api/accounts/${other._id}/activity?cursor=` + encodeURIComponent(first.nextCursor))).status, 422);
        assert.deepEqual(await snapshot(), before);
        report.assertions.push('23 real stored events page without duplicate/loss; signed cursor rejects other account/user and changed limit; zero BSON writes');
    });
    await t.test('real event insertion failure after domain create rolls all data and fences back', async () => {
        const info = (await db.listCollections({ name: 'events' }).toArray())[0];
        const before = await snapshot();
        await db.command({ collMod: 'events', validator: { $and: [info.options.validator, { code: { $ne: 'category.created' } }] } });
        try {
            const result = await call(owner.token, 'POST', '/api/categories', { accountId: account._id, name: 'Must rollback' });
            assert.equal(result.status, 500, result.text);
            assert.deepEqual(await snapshot(), before, 'category, actor/account fences, events unchanged after real Mongo 121');
        } finally {
            await db.command({ collMod: 'events', validator: info.options.validator });
        }
        report.assertions.push('HTTP500 on real Mongo event insert 121 after Category.create; full snapshot byte-equivalent');
    });
    await t.test('stored actor comes from JWT; foreign references and client authority cannot grant scope', async () => {
        const foreign = await expectCall(outsider, 'POST', '/api/categories', { accountId: other._id, name: 'Foreign category' }, 201);
        const before = await snapshot();
        assert.equal((await call(owner.token, 'PATCH', `/api/categories/${foreign._id}`, { name: 'Stolen' })).status, 404);
        assert.deepEqual(await snapshot(), before);
        const created = await expectCall(owner, 'POST', '/api/categories', { accountId: account._id, name: 'Own', actor: { kind: 'system' }, trigger: { kind: 'automation' }, subject: { kind: 'account', id: other._id } }, 201);
        const event = await db.collection('events').findOne({ code: 'category.created', 'subject.id': created._id });
        assert.deepEqual(event.actor, { kind: 'user', userId: owner.userId });
        assert.deepEqual(event.trigger, { kind: 'user_action' });
        assert.equal(event.subject.id, created._id);
        assert.equal(String(event.accountId), account._id);
        report.assertions.push('foreign PATCH404 zero writes; forged actor/trigger/subject ignored; event uses verified owner JWT');
    });
    await t.test('legacy payload minimization, legacy actor unknown, deleted-user JWT rejected', async () => {
        const legacy = {
            _id: new ObjectId(),
            accountId: new ObjectId(account._id),
            date: new Date(),
            code: 'transaction.created',
            params: { transactionId: String(new ObjectId()), type: 'expense', amountMinor: 12, notes: 'SECRET-NOTE', token: 'SECRET-TOKEN' },
            createdByMemberId: new ObjectId(account.members[0].memberId)
        };
        await db.collection('events').insertOne(legacy);
        const raw = BSON.serialize(await db.collection('events').findOne({ _id: legacy._id }));
        const before = await snapshot();
        const page = await expectCall(owner, 'GET', path + '?limit=100');
        assert.equal(JSON.stringify(page).includes('SECRET'), false);
        assert.equal(page.items.find((e) => e.id === String(legacy._id)).actor.kind, 'unknown');
        assert.deepEqual(BSON.serialize(await db.collection('events').findOne({ _id: legacy._id })), raw);
        assert.deepEqual(await snapshot(), before);
        await db.collection('users').deleteOne({ _id: new ObjectId(outsider.userId) });
        const removed = await snapshot();
        assert.equal((await call(outsider.token, 'GET', `/api/accounts/${other._id}/activity`)).status, 401);
        assert.equal((await call(outsider.token, 'POST', '/api/categories', { accountId: other._id, name: 'Denied' })).status, 401);
        assert.deepEqual(await snapshot(), removed);
        report.assertions.push('legacy unknown actor; PII omitted and persisted BSON unchanged; physically deleted user JWT401 read/write');
    });
    await t.test('maintenance immediately blocks auth, domain and activity requests without BSON writes', async () => {
        // This synthetic lock belongs only to this test's own temporary database, never to a migration run.
        const locks = db.collection('_tobu_migration_control');
        const marker = randomUUID();
        const authSnapshot = async () => Promise.all(['users', 'auth_sessions'].map(async (name) => [name, (await db.collection(name).find({}).sort({ _id: 1 }).toArray()).map((row) => BSON.serialize(row))]));
        assert.equal((await call(owner.token, 'GET', path)).status, 200);
        const before = await snapshot();
        const authBefore = await authSnapshot();
        await locks.insertOne({ _id: 'runner', reviewerSynthetic: marker });
        try {
            for (const [token, method, route, body] of [
                [owner.token, 'GET', path],
                [undefined, 'POST', '/api/auth/login', { email: owner.email, password: owner.password }],
                [undefined, 'POST', '/api/auth/register', { email: 'maintenance-denied@example.test', name: 'Denied', password: 'maintenance-denied-password' }],
                [owner.token, 'POST', '/api/categories', { accountId: account._id, name: 'Denied during maintenance' }]
            ]) {
                const result = await call(token, method, route, body);
                assert.equal(result.status, 503, method + ' ' + route);
                assert.equal(result.text, 'Database migration maintenance');
                assert.deepEqual(await snapshot(), before);
                assert.deepEqual(await authSnapshot(), authBefore, 'blocked auth must neither rotate/create sessions nor update user BSON');
            }
        } finally {
            const removed = await locks.deleteOne({ _id: 'runner', reviewerSynthetic: marker });
            assert.equal(removed.deletedCount, 1, 'remove only the lock owned by this disposable fixture');
        }
        report.assertions.push('successful GET immediately before synthetic lock; next GET/login/register/categoryPOST503; all domain/event/user/session BSON unchanged; only owned synthetic lock cleaned');
    });
    await t.test('populated future TTL backup fails closed without changing monitor, indexes or BSON', async () => {
        const isolated = await temporaryDatabase();
        let client;
        let scratch;
        try {
            const parsed = new URL(isolated.uri);
            assert.equal(parsed.protocol, 'mongodb:');
            assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname));
            assert.match(parsed.pathname, /^\/tobu_test_[a-f0-9]{32}$/);
            scratch = await mkdtemp(join(tmpdir(), 'tobu-e08-ttl-review-'));
            client = await new MongoClient(isolated.uri).connect();
            const ttlDb = client.db();
            assert.ok((await client.db('admin').command({ hello: 1 })).setName);
            await ttlDb.createCollection('reviewer_future_ttl');
            const collection = ttlDb.collection('reviewer_future_ttl');
            await collection.createIndex({ expiresAt: 1 }, { name: 'reviewer_future_ttl', expireAfterSeconds: 0 });
            await collection.insertOne({ _id: new ObjectId(), expiresAt: DateTime.utc().plus({ days: 1 }).toJSDate(), value: 'retained fixture' });
            const state = async () =>
                BSON.serialize({ options: (await ttlDb.listCollections({ name: 'reviewer_future_ttl' }).toArray())[0].options, indexes: await collection.listIndexes().toArray(), rows: await collection.find({}).sort({ _id: 1 }).toArray() });
            const before = await state();
            const monitorBefore = (await client.db('admin').command({ getParameter: 1, ttlMonitorEnabled: 1 })).ttlMonitorEnabled;
            assert.equal(monitorBefore, true);
            const backup = new ToolsBackup(client, ttlDb, isolated.uri, scratch, 'docker-local');
            await assert.rejects(backup.prepare(randomUUID(), 'a'.repeat(64)), /Populated TTL collection requires a controlled TTL pause or another backup strategy/);
            assert.deepEqual(await state(), before, 'future TTL data, collection options and actual TTL index remain BSON-identical');
            assert.equal((await client.db('admin').command({ getParameter: 1, ttlMonitorEnabled: 1 })).ttlMonitorEnabled, monitorBefore);
            report.assertions.push('actual ToolsBackup.prepare refuses populated future TTL collection; monitor stays enabled; collection/index/data BSON identical');
        } finally {
            try {
                await client?.close();
            } finally {
                try {
                    await isolated.stop();
                } finally {
                    if (scratch) {
                        assert.equal(dirname(resolve(scratch)), resolve(tmpdir()), 'verified OS-temp child before recursive cleanup');
                        await rm(scratch, { recursive: true, force: true });
                    }
                }
            }
        }
    });
    const evidence = new URL('../../../../test-results/e08/security-review-results.json', import.meta.url);
    await mkdir(new URL('./', evidence), { recursive: true });
    await writeFile(evidence, JSON.stringify(report, null, 2));
});
