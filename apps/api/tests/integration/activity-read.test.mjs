import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { ActivityPageSchema } from '@tobu/contracts/activity';
import { activityStack } from '../fixtures/activity-stack.mjs';
import { activityStorageRanges, ACTIVITY_READ_INDEX } from '../../dist/src/services/activity-storage.js';

test('E06 real authenticated read, pagination, privacy, read-only and 10k indexes', { timeout: 300000 }, async (t) => {
    const { db, call, register, snapshot, expectCall } = await activityStack(t);
    const alice = await register('e06alice'),
        bob = await register('e06bob'),
        foreign = await register('e06foreign');
    const account = await expectCall(alice, 'POST', '/api/accounts', { name: 'Activity' }, 201);
    const other = await expectCall(foreign, 'POST', '/api/accounts', { name: 'Private' }, 201);
    await db.collection('users').updateOne({ _id: new ObjectId(foreign.userId) }, { $set: { roles: ['admin'] } });
    const adminLogin = await expectCall(undefined, 'POST', '/api/auth/login', { email: foreign.email, password: foreign.password });
    foreign.token = adminLogin.accessToken;
    const accountId = account._id,
        accountOid = new ObjectId(accountId);
    const path = `/api/accounts/${accountId}/activity`;
    const member = await expectCall(bob, 'POST', '/api/members', { name: 'Reader', userId: bob.userId }, 201);
    await db.collection('accounts').updateOne({ _id: accountOid }, { $push: { members: { memberId: new ObjectId(member._id), role: 'member' } } });
    const read = async (query = '', who = alice) => ActivityPageSchema.parse(await expectCall(who, 'GET', path + query));
    const row = (overrides = {}) => ({
        _id: new ObjectId(),
        accountId: accountOid,
        date: new Date('2026-11-08T12:00:00.000Z'),
        schemaVersion: 1,
        code: 'account.settings.updated',
        actor: { kind: 'user', userId: alice.userId },
        trigger: { kind: 'user_action' },
        subject: { kind: 'account', id: accountId },
        params: { changedFields: ['name'] },
        correlationId: 'e06-command',
        ...overrides
    });
    await db.collection('events').deleteMany({ accountId: accountOid });
    const ties = Array.from({ length: 47 }, (_, i) => row({ date: new Date(i < 25 ? '2026-11-08T12:00:00.000Z' : '2026-11-08T11:00:00.000Z') }));
    await db.collection('events').insertMany(ties);
    await t.test('EIT08/21/22 real owner/member/unauth/IDOR; equal timestamp keysets', async () => {
        const before = await snapshot();
        assert.equal((await call(undefined, 'GET', path)).status, 401);
        for (const suffix of ['/activity', '/overview']) {
            const denied = await call(foreign.token, 'GET', `/api/accounts/${accountId}${suffix}`);
            const missing = await call(foreign.token, 'GET', `/api/accounts/${new ObjectId()}${suffix}`);
            assert.equal(denied.status, 404);
            assert.equal(missing.status, 404);
            assert.equal(denied.text, missing.text);
        }
        assert.equal((await read('', bob)).items.length, 20);
        const first = await read();
        assert.equal(first.items.length, 20);
        assert.ok(first.nextCursor.length <= 512);
        const all = [...first.items];
        let cursor = first.nextCursor;
        while (cursor) {
            const page = await read(`?cursor=${encodeURIComponent(cursor)}`);
            all.push(...page.items);
            cursor = page.nextCursor;
        }
        assert.deepEqual(
            all.map((e) => e.id),
            [...ties].sort((a, b) => Number(b.date) - Number(a.date) || String(b._id).localeCompare(String(a._id))).map((e) => String(e._id))
        );
        assert.equal(new Set(all.map((e) => e.id)).size, 47);
        const bounded = await read('?from=2026-11-08T11:00:00Z&to=2026-11-08T12:00:00Z&limit=100');
        assert.deepEqual(
            bounded.items.map((e) => e.id),
            all.filter((e) => e.occurredAt === '2026-11-08T11:00:00.000Z').map((e) => e.id)
        );
        const overview = await expectCall(alice, 'GET', `/api/accounts/${accountId}/overview`);
        assert.deepEqual(
            overview.timeline.map((e) => e.id),
            first.items.map((e) => e.id)
        );
        for (const q of [`?cursor=${first.nextCursor}x`, `?cursor=${first.nextCursor}&limit=100`, `?cursor=${first.nextCursor}&actorKind=user`, '?limit=101', '?code[foo]=x', '?from=2026-11-08T12:00:00.0001Z', '?subjectId=bad', '?unexpected=x'])
            assert.equal((await call(alice.token, 'GET', path + q)).status, 422, q);
        assert.equal((await call(bob.token, 'GET', `${path}?cursor=${first.nextCursor}`)).status, 422, 'cursor binds verified user');
        assert.equal((await call(foreign.token, 'GET', `/api/accounts/${other._id}/activity?cursor=${first.nextCursor}`)).status, 422, 'cursor binds account');
        assert.deepEqual(await snapshot(), before, 'every GET including preview/errors entirely write-free');
        await db.collection('accounts').updateOne({ _id: accountOid }, { $pull: { members: { memberId: new ObjectId(member._id) } } });
        const revoked = await snapshot();
        assert.equal((await call(bob.token, 'GET', path)).status, 404);
        assert.equal((await call(bob.token, 'GET', `/api/accounts/${accountId}/overview`)).status, 404);
        assert.deepEqual(await snapshot(), revoked);
        await db.collection('accounts').updateOne({ _id: accountOid }, { $push: { members: { memberId: new ObjectId(member._id), role: 'member' } } });
        await db.collection('users').updateOne({ _id: new ObjectId(bob.userId) }, { $set: { isActive: false } });
        assert.equal((await call(bob.token, 'GET', path)).status, 401);
        await db.collection('users').updateOne({ _id: new ObjectId(bob.userId) }, { $set: { isActive: true } });
    });
    await t.test('EIT23/24 safe actor, unknown, foreign/missing refs, deleted receipt and trusted grouping', async () => {
        const ownerId = account.members.find((m) => m.role === 'owner').memberId;
        await db.collection('members').updateOne({ _id: new ObjectId(ownerId) }, { $set: { name: '😀'.repeat(100) } });
        const categoryId = String(new ObjectId()),
            missingId = String(new ObjectId());
        const foreignCategory = await expectCall(foreign, 'POST', '/api/categories', { accountId: other._id, name: 'Foreign Secret' }, 201);
        const subjectId = String(new ObjectId());
        const category = (id) => ({ kind: 'category', id });
        const fixture = [
            row({ code: 'category.created', subject: category(categoryId), params: { categoryId, name: '<img src=x onerror=alert(1)>' } }),
            row({ code: 'category.deleted', subject: category(categoryId), params: { categoryId, name: 'Gone' } }),
            row({ code: 'category.updated', subject: category(foreignCategory._id), params: { categoryId: foreignCategory._id, changedFields: ['name'], name: 'SENSITIVE' } }),
            row({ code: 'category.updated', subject: category(missingId), params: { categoryId: missingId, changedFields: ['name'], name: 'SENSITIVE' } }),
            row({ code: 'transaction.updated', subject: { kind: 'transaction', id: subjectId }, params: { transactionId: subjectId, changedFields: ['categoryId'], categoryId: { from: categoryId, to: foreignCategory._id } } }),
            row({ actor: { kind: 'system' }, trigger: { kind: 'automation', initiatedByUserId: alice.userId }, batchId: 'e06-batch' }),
            row({ schemaVersion: 999, params: { notes: 'SECRET'.repeat(100000), token: 'SECRET' } }),
            { _id: new ObjectId(), accountId: accountOid, date: new Date('2026-11-08T12:00:00.000Z'), type: 'unknown', createdByMemberId: member._id, token: 'SECRET', batchId: 'e06-batch' }
        ];
        await db.collection('events').deleteMany({ accountId: accountOid });
        await db.collection('events').insertMany(fixture, { bypassDocumentValidation: true });
        const before = await snapshot();
        const page = await read('?limit=100');
        const byId = new Map(page.items.map((e) => [e.id, e]));
        const get = (i) => byId.get(String(fixture[i]._id));
        assert.equal(get(0).subject.deleted, true);
        assert.equal(get(1).subject.deleted, true);
        for (const i of [2, 3, 4]) {
            assert.equal(get(i).subject, null);
            assert.equal(get(i).params, null);
            assert.equal(get(i).detailsUnavailable, true);
        }
        assert.deepEqual({ ...get(2), id: null }, { ...get(3), id: null }, 'foreign and nonexistent references indistinguishable');
        assert.equal(get(0).group.key, get(1).group.key, 'one correlation groups mixed codes');
        assert.equal(get(5).actor.kind, 'system');
        assert.equal(get(5).trigger.initiatedBy.memberId, ownerId);
        assert.ok(get(0).actor.displayName.length <= 120);
        assert.equal(Array.from(get(0).actor.displayName).length, 60);
        for (const i of [6, 7]) {
            assert.equal(get(i).actor.kind, 'unknown');
            assert.equal(get(i).group, undefined);
            assert.equal(get(i).code, 'legacy.unknown');
        }
        assert.equal(JSON.stringify(page).includes('SECRET'), false);
        assert.equal(JSON.stringify(page).includes('SENSITIVE'), false);
        assert.equal(JSON.stringify(page).includes('Foreign Secret'), false);
        assert.equal((await read('?actorKind=unknown')).items.length, 2);
        assert.equal((await read('?code=legacy.unknown')).items.length, 2);
        assert.equal((await read(`?subjectKind=category&subjectId=${categoryId}`)).items.length, 2);
        assert.equal((await read('?from=2026-11-08T12:00:00Z&to=2026-11-08T12:00:00.5Z')).items.length, fixture.length);
        await expectCall(alice, 'GET', `/api/accounts/${accountId}/overview`);
        assert.deepEqual(await snapshot(), before, 'privacy hydration and preview have zero BSON writes');
        for (const damaged of [row({ date: 'not-a-date' }), row({ date: '2026-11-08T12:00:00.000Z' }), row({ _id: String(new ObjectId()) })]) {
            await db.collection('events').insertOne(damaged, { bypassDocumentValidation: true });
            const broken = await snapshot();
            assert.equal((await call(alice.token, 'GET', path)).status, 503, 'invalid BSON comparison types fail closed, even when portable strings look valid');
            assert.deepEqual(await snapshot(), broken, 'invalid BSON rejection does not repair data');
            await db.collection('events').deleteOne({ _id: damaged._id });
        }
        const proofId = String(new ObjectId());
        const proofSubject = { kind: 'category', id: proofId };
        const proofRows = Array.from({ length: 150 }, () => row({ code: 'category.updated', subject: proofSubject, params: { categoryId: proofId, changedFields: ['name'] } }));
        const badProof = row({ _id: String(new ObjectId()), date: '2026-11-08T10:00:00.000Z', code: 'category.created', subject: proofSubject, params: { categoryId: proofId, name: 'Untrusted receipt' } });
        await db.collection('events').insertMany([...proofRows, badProof], { bypassDocumentValidation: true });
        const badReceiptSnapshot = await snapshot();
        assert.equal((await call(alice.token, 'GET', path)).status, 503, 'a corrupt historical proof outside the loaded raw window grants no retained details');
        assert.deepEqual(await snapshot(), badReceiptSnapshot);
    });
    await t.test('EIT33 actual 10k route duration, filters, retained deletion provenance and keyset explain', async () => {
        await db.collection('events').deleteMany({ accountId: accountOid });
        const categoryId = String(new ObjectId());
        const records = Array.from({ length: 10000 }, (_, i) =>
            row({
                code: i === 0 ? 'category.created' : 'category.updated',
                subject: { kind: 'category', id: categoryId },
                params: i === 0 ? { categoryId, name: 'Deleted' } : { categoryId, changedFields: ['name'], name: 'Deleted' },
                correlationId: `e06-command-${Math.floor(i / 35)}`,
                ...(i === 9820 ? { actor: { kind: 'system' }, trigger: { kind: 'automation' } } : {})
            })
        );
        await db.collection('events').insertMany(records);
        const before = await snapshot();
        const started = performance.now();
        const first = await read();
        const firstMs = performance.now() - started;
        const nextStart = performance.now();
        const second = await read(`?cursor=${first.nextCursor}`);
        const nextMs = performance.now() - nextStart;
        assert.equal(first.items.length, 20);
        assert.equal(second.items.length, 20);
        assert.ok(first.items.every((e) => e.subject?.deleted));
        assert.equal(new Set([...first.items, ...second.items].map((e) => e.id)).size, 40);
        assert.equal(first.items[0].group.key, second.items[0].group.key, 'trusted batch context stable across page boundary');
        assert.ok(firstMs < 5000 && nextMs < 5000, `10k HTTP page including provenance: ${firstMs}/${nextMs}ms`);
        const cursorPayload = JSON.parse(Buffer.from(first.nextCursor.split('.')[0], 'base64url').toString());
        const deep = { date: cursorPayload.date, id: String(records[100]._id) };
        const matchers = [...activityStorageRanges(accountId), ...activityStorageRanges(accountId, undefined, undefined, cursorPayload), ...activityStorageRanges(accountId, undefined, undefined, deep)];
        const plans = [];
        for (const matcher of matchers) {
            const explain = await db.collection('events').find(matcher).sort({ date: -1, _id: -1 }).hint(ACTIVITY_READ_INDEX).limit(100).explain('executionStats');
            const plan = JSON.stringify(explain.queryPlanner.winningPlan);
            assert.ok(plan.includes('IXSCAN'));
            assert.equal(/"stage":"(?:COLLSCAN|SORT)"/.test(plan), false);
            assert.ok(explain.executionStats.totalDocsExamined <= 100, JSON.stringify(explain.executionStats));
            assert.ok(explain.executionStats.totalKeysExamined <= 102, 'deep page must seek, never scan previous pages');
            plans.push(explain);
        }
        const provenance = await db
            .collection('events')
            .aggregate([{ $match: { accountId: accountOid, schemaVersion: 1, code: { $in: ['category.created'] }, 'subject.kind': 'category', 'subject.id': { $in: [categoryId] } } }, { $group: { _id: '$subject.id', proof: { $first: '$$ROOT' } } }])
            .explain('executionStats');
        const empty = await read('?actorKind=system');
        assert.equal(empty.items.length, 0);
        assert.ok(empty.nextCursor, 'selective scan yields resumable empty page');
        const resumed = await read(`?actorKind=system&cursor=${empty.nextCursor}`);
        assert.deepEqual(
            resumed.items.map((e) => e.id),
            [String(records[9820]._id)],
            'resume after last scanned row reaches later projected match'
        );
        assert.deepEqual(await snapshot(), before, '10k reads preserve all financial sums/events/revisions');
        await writeFile(new URL('../../../../test-results/e06/read-10k.json', import.meta.url), JSON.stringify({ firstMs, nextMs, plans, provenance }, null, 2));
    });
});
