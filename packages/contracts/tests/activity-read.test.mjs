import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityItemSchema, ActivityPageSchema, ActivityQuerySchema, ActivityWriteEventSchema, activityCodeNames, ACTIVITY_CODES, renderActivityText } from '../dist/activity.js';
import { assertResponse } from '../dist/endpoints.js';
const id = 'a'.repeat(24);
const item = {
    id,
    accountId: id,
    occurredAt: '2026-11-08T12:00:00.000Z',
    schemaVersion: 1,
    code: 'transaction.created',
    actor: { kind: 'user', memberId: null, displayName: null },
    trigger: { kind: 'user_action' },
    subject: { kind: 'transaction', id, deleted: false },
    params: { transactionId: id, type: 'expense', amountMinor: 1234 }
};

test('E06 route is contracted, defaults to 20 and caps at 100; filters are strict', () => {
    assert.equal(ActivityQuerySchema.parse({}).limit, 20);
    assert.equal(ActivityQuerySchema.parse({ limit: '100', code: 'legacy.unknown', actorKind: 'unknown' }).limit, 100);
    for (const input of [{ limit: 101 }, { limit: 0 }, { cursor: 'x'.repeat(513) }, { actorKind: 'admin' }, { subjectId: 'nope' }, { unexpected: true }, { code: { $ne: '' } }]) assert.equal(ActivityQuerySchema.safeParse(input).success, false);
    assertResponse('GET', `/api/accounts/${id}/activity`, 200, { items: [item], nextCursor: null });
});
test('UTC filters compare actual instants across zero/one/two/three fractional digits', () => {
    for (const to of ['2026-11-08T12:00:00.5Z', '2026-11-08T12:00:00.50Z', '2026-11-08T12:00:00.500Z']) assert.equal(ActivityQuerySchema.safeParse({ from: '2026-11-08T12:00:00Z', to }).success, true);
    for (const pair of [
        ['2026-11-08T12:00:00Z', '2026-11-08T12:00:00.000Z'],
        ['2026-11-08T12:00:00.500Z', '2026-11-08T12:00:00.5Z'],
        ['2026-11-08T12:00:00.501Z', '2026-11-08T12:00:00.5Z']
    ])
        assert.equal(ActivityQuerySchema.safeParse({ from: pair[0], to: pair[1] }).success, false);
    assert.equal(ActivityQuerySchema.safeParse({ from: '2026-11-08T12:00:00.0001Z' }).success, false, 'do not silently round sub-millisecond filters');
});
test('redaction preserves known action and actor without exposing any reference or write bypass', () => {
    const redacted = { ...item, subject: null, params: null, detailsUnavailable: true };
    assert.deepEqual(ActivityItemSchema.parse(redacted), redacted);
    assert.equal(renderActivityText(redacted), 'Buchung angelegt – Details nicht verfügbar');
    assert.equal(ActivityItemSchema.safeParse({ ...redacted, subject: item.subject }).success, false);
    assert.equal(ActivityItemSchema.safeParse({ ...item, params: null }).success, false);
    assert.equal(ActivityItemSchema.safeParse({ ...item, detailsUnavailable: true }).success, false);
    assert.equal(ActivityWriteEventSchema.safeParse({ ...redacted, date: new Date(), actor: { kind: 'user', userId: id } }).success, false);
});
test('only validated current records can carry loaded-only grouping; no total/success claim', () => {
    const grouped = { ...item, group: { key: 'a'.repeat(64), source: 'batch', scope: 'loaded_only' } };
    assert.equal(ActivityItemSchema.safeParse(grouped).success, true);
    for (const group of [
        { ...grouped.group, complete: true },
        { ...grouped.group, total: 10 },
        { ...grouped.group, scope: 'all_successful' }
    ])
        assert.equal(ActivityItemSchema.safeParse({ ...item, group }).success, false);
    assert.equal(ActivityItemSchema.safeParse({ ...grouped, schemaVersion: 0 }).success, false);
    assert.equal(ActivityPageSchema.safeParse({ items: [], nextCursor: 'next' }).success, true, 'bounded scanning may return a resumable empty page');
    assert.deepEqual(Object.keys(activityCodeNames).sort(), [...ACTIVITY_CODES].sort());
});
