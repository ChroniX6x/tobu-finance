import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ObjectId } from 'mongodb';
import { activityStack } from '../fixtures/activity-stack.mjs';

async function account(stack, user) {
    const member = await stack.expectCall(user, 'POST', '/api/members', { name: 'Self', userId: user.userId }, 201);
    const row = await stack.expectCall(user, 'POST', '/api/accounts', { name: 'P02 account', members: [{ memberId: member._id }] }, 201);
    return { id: row._id, member: member._id };
}

test('P02 real HTTP: provenance, distribution, caller role and rejected requests write nothing', { timeout: 300000 }, async (t) => {
    const s = await activityStack(t);
    const owner = await s.register('p02-owner');
    const other = await s.register('p02-other');
    const a = await account(s, owner);
    const b = await account(s, other);
    const rec = await s.expectCall(owner, 'POST', '/api/recurrences', { accountId: a.id, type: 'expense', amountMinor: 100 }, 201);
    const body = { accountId: a.id, type: 'expense', title: 'P02', amountMinor: 101, month: '2026-11', isFromSharedAccount: true };
    const parent = await s.expectCall(owner, 'POST', '/api/transactions', body, 201);
    const child = await s.expectCall(owner, 'POST', '/api/transactions', { ...body, amountMinor: 51, parentTransactionId: parent._id }, 201);
    const reject = async (user, method, path, body, status) => {
        const before = await s.snapshot();
        await s.expectCall(user, method, path, body, status);
        assert.deepEqual(await s.snapshot(), before, `${method} ${path}: zero domain/event/revision writes`);
    };
    await t.test('normal parent and split commands cannot forge or erase origin', async () => {
        for (const key of ['recurrenceId', 'occurrenceId', 'occurrenceKey', 'sourceRevisionId', 'origin', 'generatedFrom', 'sourceRecurrenceId']) {
            for (const value of [rec._id, null]) {
                await reject(owner, 'POST', '/api/transactions', { ...body, [key]: value }, 400);
                for (const tx of [parent, child]) await reject(owner, 'PATCH', `/api/transactions/${tx._id}`, { title: 'forged', [key]: value }, 400);
            }
        }
        // Represents an existing legacy association; ordinary edits must preserve it.
        await s.db.collection('transactions').updateOne({ _id: new ObjectId(parent._id) }, { $set: { recurrenceId: new ObjectId(rec._id) } });
        const edited = await s.expectCall(owner, 'PATCH', `/api/transactions/${parent._id}`, { title: 'ordinary edit' });
        assert.equal(edited.recurrenceId, rec._id);
        assert.equal(String((await s.db.collection('transactions').findOne({ _id: new ObjectId(parent._id) })).recurrenceId), rec._id);
    });
    await t.test('all distributions validate before writes, including stored legacy values and null echoes', async () => {
        const base = { accountId: a.id, type: 'additional', recurring: false, amountMinor: 123 };
        const rule = await s.expectCall(owner, 'POST', '/api/contribution-rules', { ...base, distribution: { mode: 'perMember', memberId: a.member, customSplit: null } }, 201);
        const invalid = [
            null,
            [],
            {},
            { mode: 'unknown' },
            { mode: 'perMember' },
            { mode: 'perMember', memberId: a.member, customSplit: [] },
            { mode: 'customSplit', customSplit: [] },
            { mode: 'customSplit', customSplit: [{ memberId: a.member, split: 99 }] },
            {
                mode: 'customSplit',
                customSplit: [
                    { memberId: a.member, split: 50 },
                    { memberId: a.member, split: 50 }
                ]
            },
            { mode: 'proRataIncome', memberId: a.member },
            { mode: 'perMember', memberId: b.member }
        ];
        for (const distribution of invalid) {
            await reject(owner, 'POST', '/api/contribution-rules', { ...base, distribution }, 422);
            await reject(owner, 'PATCH', `/api/contribution-rules/${rule._id}`, { amountMinor: 456, distribution }, 422);
        }
        for (const distribution of [
            { mode: 'perMember', memberId: a.member, customSplit: null },
            { mode: 'customSplit', memberId: null, customSplit: [{ memberId: a.member, split: 100 }] },
            { mode: 'proRataIncome', memberId: null, customSplit: null }
        ]) {
            await s.expectCall(owner, 'PATCH', `/api/contribution-rules/${rule._id}`, { distribution });
            await s.expectCall(owner, 'PATCH', `/api/contribution-rules/${rule._id}`, { description: distribution.mode });
        }
        await s.db.collection('contribution_rules').updateOne({ _id: new ObjectId(rule._id) }, { $set: { distribution: { mode: 'perMember' } } });
        assert.equal((await s.db.collection('contribution_rules').findOne({ _id: new ObjectId(rule._id) })).distribution.memberId, undefined);
        await reject(owner, 'PATCH', `/api/contribution-rules/${rule._id}`, { amountMinor: 999 }, 422);
    });
    await t.test('server-derived owner/member role, owner mutations blocked, category create remains allowed', async () => {
        const path = `/api/accounts/${a.id}/master-data`;
        assert.equal((await s.expectCall(owner, 'GET', path)).account.callerRole, 'owner');
        await reject(other, 'GET', path, undefined, 404);
        await s.db.collection('accounts').updateOne({ _id: new ObjectId(a.id) }, { $push: { members: { memberId: new ObjectId(b.member), role: 'member' } } });
        assert.equal((await s.expectCall(other, 'GET', path)).account.callerRole, 'member');
        await reject(other, 'PATCH', `/api/accounts/${a.id}`, { name: 'escalated' }, 403);
        await reject(other, 'POST', `/api/accounts/${a.id}/members`, { memberId: a.member, role: 'owner' }, 403);
        await s.expectCall(other, 'POST', '/api/categories', { accountId: a.id, name: 'Member category' }, 201);
        // Legacy U/F delete policy stays intact.
        await s.expectCall(other, 'DELETE', `/api/recurrences/${rec._id}`, undefined, 204);
    });
});

for (const [zone, instant, month] of [
    ['Pacific/Honolulu', '2027-01-01T00:00:00.000Z', '2027-01'],
    ['Pacific/Kiritimati', '2026-12-31T23:59:59.999Z', '2026-12'],
    ['UTC', '2026-02-28T23:59:59.999Z', '2026-02']
]) {
    test(`P02 legacy default UTC month: ${zone} at ${instant}`, { timeout: 180000 }, async (t) => {
        const s = await activityStack(t, { zone, instant });
        const owner = await s.register('p02-calendar');
        const a = await account(s, owner);
        const body = { accountId: a.id, type: 'expense', amountMinor: 123 };
        const row = await s.expectCall(owner, 'POST', '/api/recurrences', body, 201);
        assert.equal(row.activeFrom, `${month}-01T00:00:00.000Z`);
        const rows = await s.expectCall(owner, 'GET', `/api/recurrences?accountId=${a.id}&activeOn=${month}`);
        assert.ok(rows.some((item) => item._id === row._id));
        assert.equal((await s.expectCall(owner, 'POST', '/api/recurrences', { ...body, title: 'explicit', activeFrom: '2020-02' }, 201)).activeFrom, '2020-02-01T00:00:00.000Z');
    });
}
