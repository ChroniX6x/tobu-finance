import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { ObjectId } from 'mongodb';
import { activityStack } from '../fixtures/activity-stack.mjs';

test('P02 global member oracle/auth/ambiguous self identity and actual ACL-to-write races', { timeout: 300000 }, async (t) => {
    const s = await activityStack(t, { apiEntry: fileURLToPath(new URL('../fixtures/p02-race-server.mjs', import.meta.url)) });
    const owner = await s.register('p02-security-owner');
    const member = await s.register('p02-security-member');
    const ownerSelf = await s.expectCall(owner, 'POST', '/api/members', { name: 'Owner self', userId: owner.userId }, 201);
    const memberSelf = await s.expectCall(member, 'POST', '/api/members', { name: 'Member self', userId: member.userId }, 201);
    const account = await s.expectCall(owner, 'POST', '/api/accounts', { name: 'P02 security', members: [{ memberId: ownerSelf._id }] }, 201);
    const accountId = new ObjectId(account._id);
    await t.test('global member foreign/unknown/unprovenanced responses and lists reveal nothing; JWT required on every method', async () => {
        const unknown = new ObjectId();
        const historical = new ObjectId();
        await s.db.collection('members').insertOne({ _id: historical, name: 'Unprovenanced historical person', email: 'hidden@example.test', userId: null });
        for (const method of ['PATCH', 'DELETE']) {
            const results = [];
            for (const id of [ownerSelf._id, unknown, historical]) {
                const before = await s.snapshot();
                const response = await s.call(member.token, method, `/api/members/${id}`, method === 'PATCH' ? { name: 'forbidden' } : undefined);
                assert.equal(response.status, 404);
                results.push(response.text);
                assert.deepEqual(await s.snapshot(), before);
            }
            assert.equal(new Set(results).size, 1, 'same foreign/unknown/historical error');
        }
        const visible = await s.expectCall(member, 'GET', '/api/members');
        assert.ok(visible.some((row) => row._id === memberSelf._id));
        for (const hidden of [ownerSelf._id, String(historical)]) assert.ok(!visible.some((row) => row._id === hidden));
        for (const token of [undefined, 'invalid.jwt.token'])
            for (const [method, path, body] of [
                ['GET', '/api/members'],
                ['POST', '/api/members', { name: 'unauthorized' }],
                ['PATCH', `/api/members/${ownerSelf._id}`, { name: 'unauthorized' }],
                ['DELETE', `/api/members/${ownerSelf._id}`]
            ]) {
                const before = await s.snapshot();
                assert.equal((await s.call(token, method, path, body)).status, 401);
                assert.deepEqual(await s.snapshot(), before);
            }
    });
    await t.test('one verified historical self is reused, multiple self identities fail closed without writes', async () => {
        const single = await s.expectCall(member, 'POST', '/api/accounts', { name: 'Reuse existing self', members: [] }, 201);
        assert.equal(single.members.filter((row) => row.memberId === memberSelf._id && row.role === 'owner').length, 1);
        assert.equal(await s.db.collection('members').countDocuments({ userId: new ObjectId(member.userId) }), 1);
        const duplicate = new ObjectId();
        await s.db.collection('members').insertOne({ _id: duplicate, name: 'Historical duplicate', userId: new ObjectId(member.userId) });
        for (const members of [[], [{ memberId: memberSelf._id }, { memberId: String(duplicate) }]]) {
            const before = await s.snapshot();
            const result = await s.call(member.token, 'POST', '/api/accounts', { name: 'Ambiguous must fail', members });
            assert.equal(result.status, 422, result.text);
            assert.deepEqual(await s.snapshot(), before);
        }
        for (const memberId of [memberSelf._id, String(duplicate)]) {
            const chosen = await s.expectCall(member, 'POST', '/api/accounts', { name: 'Explicit verified self', members: [{ memberId }] }, 201);
            assert.deepEqual(
                chosen.members.map((row) => ({ memberId: row.memberId, role: row.role })),
                [{ memberId, role: 'owner' }]
            );
            assert.equal(await s.db.collection('members').countDocuments({ userId: new ObjectId(member.userId) }), 2);
        }
        await s.db.collection('members').deleteOne({ _id: duplicate });
    });
    const category = await s.expectCall(owner, 'POST', '/api/categories', { accountId: account._id, name: 'Race category' }, 201);
    const recurrence = await s.expectCall(owner, 'POST', '/api/recurrences', { accountId: account._id, type: 'expense', amountMinor: 101 }, 201);
    const budget = await s.expectCall(owner, 'POST', '/api/category-budgets', { accountId: account._id, categoryId: category._id, amountMinor: 101, fromMonth: '2026-11' }, 201);
    for (const revoke of ['membership', 'active-user'])
        for (const [route, id, patch] of [
            ['categories', category._id, { name: 'stale category' }],
            ['recurrences', recurrence._id, { title: 'stale recurrence' }],
            ['category-budgets', budget._id, { amountMinor: 999 }]
        ])
            await t.test(`${route}: ${revoke} committed after successful ACL read but before writer; zero stale writes`, async () => {
                await s.db.collection('users').updateOne({ _id: new ObjectId(member.userId) }, { $set: { isActive: true } });
                await s.db.collection('accounts').updateOne({ _id: accountId }, { $pull: { members: { memberId: new ObjectId(memberSelf._id) } } });
                await s.db.collection('accounts').updateOne({ _id: accountId }, { $push: { members: { memberId: new ObjectId(memberSelf._id), role: 'member' } } });
                const url = s.base + `/api/${route}/${id}`;
                const init = { method: 'PATCH', headers: { authorization: 'Bearer ' + member.token, 'content-type': 'application/json' }, body: JSON.stringify(patch), signal: AbortSignal.timeout(15000) };
                const beforeProof = await s.snapshot();
                const challenge = await fetch(url, init);
                assert.equal(challenge.status, 428);
                const { mutationProof } = await challenge.json();
                assert.equal(typeof mutationProof, 'string');
                assert.deepEqual(await s.snapshot(), beforeProof, 'proof negotiation writes nothing');
                const armed = once(s.apiProcess, 'message');
                s.apiProcess.send({ type: 'arm', accountId: account._id });
                assert.equal((await armed)[0].state, 'armed');
                const paused = once(s.apiProcess, 'message');
                const request = fetch(url, { ...init, headers: { ...init.headers, 'X-Tobu-Mutation': mutationProof } });
                assert.equal((await paused)[0].state, 'preflight-read-completed');
                if (revoke === 'membership') await s.db.collection('accounts').updateOne({ _id: accountId }, { $pull: { members: { memberId: new ObjectId(memberSelf._id) } } });
                else await s.db.collection('users').updateOne({ _id: new ObjectId(member.userId) }, { $set: { isActive: false } });
                const before = await s.snapshot();
                s.apiProcess.send({ type: 'resume' });
                const result = await request;
                const rejected = await result.json();
                assert.equal(result.status, 409, `${route}: ${JSON.stringify(rejected)}`);
                assert.equal(rejected.error, 'ACTIVITY_AUTHORITY_CHANGED');
                assert.deepEqual(await s.snapshot(), before, 'rejection must roll back all account/user fences, domain changes and events');
            });
});
