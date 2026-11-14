import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateTx, PatchTx } from '../dist/transactions.js';
import { CreateContributionRule, UpdateContributionRule } from '../dist/contribution-rules.js';

const id = '507f1f77bcf86cd799439011';
const tx = { accountId: id, title: 'Pending', type: 'expense', amountMinor: 1234, month: '2026-11', isFromSharedAccount: true };
const rule = { accountId: id, type: 'additional', recurring: false, amountMinor: 1234 };

test('P02: generic transaction writes reject server-owned links, revisions and provenance', () => {
    for (const field of ['recurrenceId', 'occurrenceId', 'occurrenceKey', 'sourceRevisionId', 'origin', 'generatedFrom', 'sourceRecurrenceId']) {
        for (const value of [id, null, { kind: 'generated' }]) {
            assert.equal(CreateTx.safeParse({ ...tx, [field]: value }).success, false, `create ${field}`);
            assert.equal(PatchTx.safeParse({ title: 'Changed', [field]: value }).success, false, `patch ${field}`);
        }
    }
    assert.equal(CreateTx.safeParse(tx).success, true);
    assert.equal(PatchTx.safeParse({ title: 'Changed' }).success, true);
});

test('P02 API001: contribution distribution validates shapes and null echoes on create and patch', () => {
    for (const distribution of [
        { mode: 'perMember', memberId: id },
        { mode: 'perMember', memberId: id, customSplit: null },
        { mode: 'proRataIncome', memberId: null, customSplit: null },
        { mode: 'customSplit', memberId: null, customSplit: [{ memberId: id, split: 100 }] }
    ]) {
        assert.equal(CreateContributionRule.safeParse({ ...rule, distribution }).success, true);
        assert.equal(UpdateContributionRule.safeParse({ distribution }).success, true);
    }
    for (const distribution of [
        null,
        [],
        {},
        { mode: 'unknown' },
        { mode: 'perMember', amounts: [1234] },
        { mode: 'perMember', memberId: id, customSplit: [{ memberId: id, split: 100 }] },
        { mode: 'proRataIncome', memberId: id },
        { mode: 'customSplit', customSplit: [] },
        { mode: 'customSplit', customSplit: [{ memberId: id, split: 99 }] },
        {
            mode: 'customSplit',
            customSplit: [
                { memberId: id, split: 50 },
                { memberId: id, split: 50 }
            ]
        }
    ]) {
        assert.equal(CreateContributionRule.safeParse({ ...rule, distribution }).success, false, JSON.stringify(distribution));
        assert.equal(UpdateContributionRule.safeParse({ distribution }).success, false, JSON.stringify(distribution));
    }
});
