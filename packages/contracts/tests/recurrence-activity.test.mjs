import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityWriteEventSchema, ActivityItemSchema, RECURRENCE_ACTIVITY_CODES, activityCatalog, decodeStoredEvent, renderActivityText, isReservedActivityCode } from '../dist/activity.js';
import { recurrenceActivityExamples } from './recurrence-activity-examples.mjs';
const id = (n) => n.toString(16).padStart(24, '0');
const examples = recurrenceActivityExamples({ recurrence: id(1), revision: id(2), previousRevision: id(3), occurrence: id(4), previousRecurrence: id(5), previousOccurrence: id(6), transaction: id(7) });
const event = (code) => ({
    accountId: id(8),
    date: new Date('2026-11-08T00:00:00.000Z'),
    schemaVersion: 1,
    code,
    actor: { kind: 'user', userId: id(9) },
    trigger: { kind: 'user_action' },
    subject: { kind: activityCatalog[code].subject, id: code.startsWith('recurrence.') ? id(1) : id(4) },
    params: examples[code]
});
test('E07 platform twelve independent code/subject/params/write/read/renderer examples, not domain execution', () => {
    assert.deepEqual(Object.keys(examples).sort(), [...RECURRENCE_ACTIVITY_CODES].sort());
    for (const code of RECURRENCE_ACTIVITY_CODES) {
        const value = event(code);
        ActivityWriteEventSchema.parse(value);
        const decoded = decodeStoredEvent({ ...value, _id: id(10) });
        assert.equal(decoded.ok, true);
        assert.equal(decoded.item.code, code);
        ActivityItemSchema.parse(decoded.item);
        assert.notEqual(renderActivityText(decoded.item), 'Aktivität');
        assert.equal(ActivityWriteEventSchema.safeParse({ ...value, params: { ...value.params, notes: 'SECRET', actorUserId: id(9), snapshot: {} } }).success, false);
        assert.equal(ActivityWriteEventSchema.safeParse({ ...value, subject: { kind: 'legacyRecurrence', id: id(1) } }).success, false);
        assert.equal(isReservedActivityCode(code), false);
    }
    assert.equal(isReservedActivityCode('recurrence.ensure_everything'), true);
});
test('EIT25/26 platform lifecycle is not config revision and delete has minimal params', () => {
    for (const code of ['recurrence.activated', 'recurrence.deactivated']) assert.equal(ActivityWriteEventSchema.safeParse({ ...event(code), params: { ...examples[code], revisionId: id(2) } }).success, false);
    assert.equal(ActivityWriteEventSchema.safeParse({ ...event('recurrence.config.updated'), params: { ...examples['recurrence.config.updated'], changedFields: ['isActive'] } }).success, false);
    assert.deepEqual(Object.keys(examples['recurrence.deleted']), ['recurrenceId']);
});
test('EIT27/28 platform month/identity boundaries and user/system emit matrix', () => {
    for (const code of RECURRENCE_ACTIVITY_CODES) {
        const value = event(code);
        assert.equal(ActivityWriteEventSchema.safeParse({ ...value, actor: { kind: 'system' }, trigger: { kind: 'automation' } }).success, code === 'occurrence.generated');
        if (code.startsWith('occurrence.')) for (const occurrenceKey of ['2026-13', '2026-11-01T00:00:00.000Z', '0999-11']) assert.equal(ActivityWriteEventSchema.safeParse({ ...value, params: { ...value.params, occurrenceKey } }).success, false);
    }
    assert.match(renderActivityText({ code: 'occurrence.unlinked', params: examples['occurrence.unlinked'] }), /ohne Buchung freigegeben/);
});
