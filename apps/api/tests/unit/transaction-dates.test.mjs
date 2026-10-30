import assert from 'node:assert/strict';
import { test } from 'node:test';
import { childDatesAgree, resolveCreateDates, resolvePatchDates } from '../../dist/src/lib/transaction-dates.js';

const NOV = '2026-11-01T00:00:00.000Z';
const iso = (d) => d?.toISOString() ?? null;
const prev = (bookDate, month = NOV) => ({ bookDate: bookDate ? new Date(bookDate) : null, month: new Date(month) });

test('create: the bookDate decides the month, a conflicting month and a missing month are rejected', () => {
    const ok = resolveCreateDates(NOV, '2026-11');
    assert.ok(ok.ok);
    assert.deepEqual([iso(ok.value.bookDate), iso(ok.value.month)], [NOV, NOV]);
    assert.deepEqual(resolveCreateDates(NOV, '2026-10'), { ok: false, error: 'MONTH_BOOKDATE_MISMATCH' });
    assert.deepEqual(resolveCreateDates(null, null), { ok: false, error: 'MONTH_REQUIRED' });
    assert.deepEqual(resolveCreateDates('0999-01-01T00:00:00.000Z', null), { ok: false, error: 'INVALID_BOOKDATE' });
    const pending = resolveCreateDates(null, '2027-01');
    assert.ok(pending.ok);
    assert.deepEqual([pending.value.bookDate, iso(pending.value.month)], [null, '2027-01-01T00:00:00.000Z']);
});

test('create: the UTC month of a legacy instant is kept (no guessing of a local calendar day)', () => {
    const result = resolveCreateDates('2026-10-31T23:00:00.000Z', null);
    assert.ok(result.ok);
    assert.equal(iso(result.value.month), '2026-10-01T00:00:00.000Z');
});

test('patch: month alone cannot move a dated transaction; equal or absent values are no-ops', () => {
    assert.deepEqual(resolvePatchDates(prev(NOV), { month: '2026-10' }), { ok: false, error: 'MONTH_BOOKDATE_MISMATCH' });
    assert.deepEqual(resolvePatchDates(prev(NOV), { month: '2026-11' }), { ok: true, value: {} });
    assert.deepEqual(resolvePatchDates(prev(NOV), {}), { ok: true, value: {} });
    assert.deepEqual(resolvePatchDates(prev(NOV), { bookDate: NOV }), { ok: true, value: {} });
    assert.deepEqual(resolvePatchDates(prev(NOV), { bookDate: '2026-12-05T00:00:00.000Z', month: '2026-11' }), { ok: false, error: 'MONTH_BOOKDATE_MISMATCH' });
    const moved = resolvePatchDates(prev(NOV), { bookDate: '2026-12-05T00:00:00.000Z' });
    assert.ok(moved.ok);
    assert.deepEqual([iso(moved.value.bookDate), iso(moved.value.month)], ['2026-12-05T00:00:00.000Z', '2026-12-01T00:00:00.000Z']);
});

test('patch: undated transactions take an explicit month; clearing a date keeps or replaces the month', () => {
    const month = resolvePatchDates(prev(null), { month: '2027-02' });
    assert.ok(month.ok);
    assert.equal(iso(month.value.month), '2027-02-01T00:00:00.000Z');
    assert.deepEqual(resolvePatchDates(prev(null), { bookDate: null }), { ok: true, value: {} });
    const cleared = resolvePatchDates(prev(NOV), { bookDate: null });
    assert.ok(cleared.ok);
    assert.deepEqual(cleared.value, { bookDate: null });
    const replaced = resolvePatchDates(prev(NOV), { bookDate: null, month: '2027-03' });
    assert.ok(replaced.ok);
    assert.equal(iso(replaced.value.month), '2027-03-01T00:00:00.000Z');
});

test('patch: legacy rows with a month that disagrees with the date are not re-derived', () => {
    const legacy = prev('2026-10-31T23:00:00.000Z', NOV);
    assert.deepEqual(resolvePatchDates(legacy, { bookDate: '2026-10-31T23:00:00.000Z' }), { ok: true, value: {} });
    assert.deepEqual(resolvePatchDates(legacy, { month: '2026-11' }), { ok: true, value: {} });
    assert.deepEqual(resolvePatchDates(legacy, { month: '2026-12' }), { ok: false, error: 'MONTH_BOOKDATE_MISMATCH' });
});

test('children must agree with their parent on month and bookDate', () => {
    const parent = prev(NOV);
    assert.equal(childDatesAgree(parent, {}), true);
    assert.equal(childDatesAgree(parent, { month: new Date(NOV), bookDate: new Date(NOV) }), true);
    assert.equal(childDatesAgree(parent, { month: new Date('2026-12-01T00:00:00.000Z') }), false);
    assert.equal(childDatesAgree(parent, { bookDate: new Date('2026-11-02T00:00:00.000Z') }), false);
    assert.equal(childDatesAgree(prev(null), { bookDate: null }), true);
    assert.equal(childDatesAgree(prev(null), { bookDate: new Date(NOV) }), false);
});
