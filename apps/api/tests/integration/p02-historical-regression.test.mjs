import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { activityStack } from '../fixtures/activity-stack.mjs';

test('P02 F5 identical ACL and rejected-budget assertions against selected route revision', { timeout: 240000 }, async (t) => {
    const historical = process.env.TOBU_P02_HISTORICAL === '1';
    const s = await activityStack(t, historical ? { apiEntry: fileURLToPath(new URL('../fixtures/p02-historical-server.mjs', import.meta.url)) } : {});
    const owner = await s.register('f5-owner');
    const outsider = await s.register('f5-outsider');
    const member = await s.expectCall(owner, 'POST', '/api/members', { name: 'Self', userId: owner.userId }, 201);
    const account = await s.expectCall(owner, 'POST', '/api/accounts', { name: 'F5 account', members: [{ memberId: member._id }] }, 201);
    // Seed legal historical domain shapes directly: the probes exercise reads and an already-overlapping budget.
    const { ObjectId } = await import('mongodb');
    const categoryId = new ObjectId();
    await s.db.collection('categories').insertOne({ _id: categoryId, accountId: new ObjectId(account._id), name: 'Private category', customSplit: [] });
    await s.db.collection('category_budgets').insertOne({ accountId: new ObjectId(account._id), categoryId, amountMinor: 321, fromMonth: new Date('2026-11-01T00:00:00.000Z'), toMonth: null });
    for (const route of ['categories', 'recurrences'])
        await t.test(`${route}: foreign account must be invisible`, async () => {
            const before = await s.snapshot();
            const response = await s.call(outsider.token, 'GET', `/api/${route}?accountId=${account._id}`);
            assert.equal(response.status, 404, `${historical ? 'historical' : 'current'} route leaked access`);
            assert.deepEqual(await s.snapshot(), before);
        });
    await t.test('409 overlapping budget must leave account, finance and events byte-identical', async () => {
        const before = await s.snapshot();
        await s.expectCall(owner, 'POST', '/api/category-budgets', { accountId: account._id, categoryId: String(categoryId), amountMinor: 999, fromMonth: '2026-11' }, 409);
        assert.deepEqual(await s.snapshot(), before, 'a rejected budget must not even update account.updatedAt');
    });
});
