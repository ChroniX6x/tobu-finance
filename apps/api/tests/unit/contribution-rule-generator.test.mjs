import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMonthsToMonthKey } from '@tobu/contracts/calendar';
import { amountPeriods } from '../../dist/src/services/contribution-rule-generator.js';

const b = (from, to, amountMinor) => ({ from, to, amountMinor });
const p = (from, to, amountMinor) => ({ from, to, amountMinor });

test('a later budget never changes earlier months (the A29 retroactivity)', () => {
    const a = b('2026-01', null, 10000);
    assert.deepEqual(amountPeriods([a]), [p('2026-01', null, 10000)]);
    assert.deepEqual(amountPeriods([a, b('2026-11', null, 5000)]), [p('2026-01', '2026-10', 10000), p('2026-11', null, 15000)]);
});

test('ended budget and follow-up budget: each month counts only the budgets valid in it, independent of any clock', () => {
    assert.deepEqual(amountPeriods([b('2026-01', '2026-11', 11100), b('2026-12', null, 22200)]), [p('2026-01', '2026-11', 11100), p('2026-12', null, 22200)]);
});

test('overlapping budgets add up only where they overlap', () => {
    assert.deepEqual(amountPeriods([b('2026-01', '2026-06', 100), b('2026-03', '2026-04', 50)]), [p('2026-01', '2026-02', 100), p('2026-03', '2026-04', 150), p('2026-05', '2026-06', 100)]);
});

test('gaps stay gaps; contiguous months with identical totals are merged', () => {
    assert.deepEqual(amountPeriods([b('2026-01', '2026-02', 100), b('2026-04', null, 100)]), [p('2026-01', '2026-02', 100), p('2026-04', null, 100)]);
    assert.deepEqual(amountPeriods([b('2026-01', '2026-06', 100), b('2026-07', '2026-12', 100)]), [p('2026-01', '2026-12', 100)]);
    assert.deepEqual(amountPeriods([b('2026-01', '2026-06', 100), b('2026-03', '2026-04', 0)]), [p('2026-01', '2026-06', 100)]);
});

test('unbounded start and end, a single month, the year boundary and a leap-year month', () => {
    assert.deepEqual(amountPeriods([b(null, '2026-06', 300)]), [p(null, '2026-06', 300)]);
    assert.deepEqual(amountPeriods([b(null, null, 300)]), [p(null, null, 300)]);
    assert.deepEqual(amountPeriods([b('2026-12', '2026-12', 40), b('2027-01', null, 60)]), [p('2026-12', '2026-12', 40), p('2027-01', null, 60)]);
    assert.deepEqual(amountPeriods([b('2028-02', '2028-02', 7)]), [p('2028-02', '2028-02', 7)]);
    assert.deepEqual(amountPeriods([]), []);
});

test('inverted budgets produce no period and the end of the supported years stays open instead of throwing', () => {
    assert.deepEqual(amountPeriods([b('2026-06', '2026-03', 100)]), []);
    assert.deepEqual(amountPeriods([b('2026-01', '9999-12', 100)]), [p('2026-01', null, 100)]);
});

test('the result is independent of the order of the budgets and equals a month-by-month evaluation', () => {
    const sets = [
        [b('2026-01', null, 10000), b('2026-11', null, 5000)],
        [b('2026-01', '2026-11', 11100), b('2026-12', null, 22200)],
        [b('2026-01', '2026-06', 100), b('2026-03', '2026-04', 50), b(null, '2026-02', 7), b('2026-05', null, 9)],
        [b('2025-12', '2026-03', 10), b('2026-03', '2026-05', 20), b('2026-05', '2026-05', 30), b(null, null, 1)]
    ];
    const months = [];
    for (let m = '2024-01'; m <= '2029-12'; m = addMonthsToMonthKey(m, 1)) months.push(m);
    for (const set of sets) {
        const periods = amountPeriods(set);
        assert.deepEqual(amountPeriods([...set].reverse()), periods);
        for (const month of months) {
            const expected = set.filter((x) => (x.from === null || x.from <= month) && (x.to === null || x.to >= month)).reduce((sum, x) => sum + x.amountMinor, 0);
            const covering = periods.filter((x) => (x.from === null || x.from <= month) && (x.to === null || x.to >= month));
            assert.ok(covering.length <= 1, `${month}: periods never overlap`);
            assert.equal(covering[0]?.amountMinor ?? 0, expected, `${month}`);
        }
    }
});
