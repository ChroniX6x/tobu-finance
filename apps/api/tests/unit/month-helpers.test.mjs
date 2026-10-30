import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { isActiveInMonth, lastNMonthAnchorsISO, monthRangeFromISO, toMonthAnchorISO, toMonthDate } from '../../dist/src/lib/month.js';
import { monthRangeFromISO as adapterRange, toMonthAnchorISO as adapterAnchor } from '../../dist/src/utils/date.js';
import { monthRangesOverlap } from '../../dist/src/utils/month-overlap.js';
import { now } from '../../dist/src/lib/clock.js';

const iso = (d) => d?.toISOString() ?? null;
const d = (key) => new Date(`${key}-01T00:00:00.000Z`);

test('toMonthDate and friends accept YYYY-MM and the exact anchor only; both old helpers are one implementation', () => {
    assert.equal(iso(toMonthDate('2026-11')), '2026-11-01T00:00:00.000Z');
    assert.equal(iso(toMonthDate('2026-11-01T00:00:00.000Z')), '2026-11-01T00:00:00.000Z');
    assert.equal(iso(toMonthDate(new Date('2026-11-17T13:00:00.000Z'))), '2026-11-01T00:00:00.000Z');
    for (const bad of ['2026-11-15T10:00:00.000Z', '2026-11-01', '2026-13', '', 'nonsense']) assert.throws(() => toMonthDate(bad), RangeError, bad);
    assert.equal(adapterAnchor, toMonthAnchorISO);
    assert.equal(adapterRange, monthRangeFromISO);
    assert.equal(toMonthAnchorISO(Date.UTC(2026, 10, 30, 23, 59)), '2026-11-01T00:00:00.000Z');
});

test('month range is half open: the first instant of the next month is not part of the month', () => {
    const { start, end } = monthRangeFromISO('2026-12');
    assert.deepEqual([iso(start), iso(end)], ['2026-12-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']);
    assert.equal(iso(monthRangeFromISO('2028-02').end), '2028-03-01T00:00:00.000Z');
});

test('last n month anchors cross the year boundary and use the UTC month of the reference', () => {
    assert.deepEqual(lastNMonthAnchorsISO(3, new Date('2027-01-31T23:59:59.999Z')), ['2026-11-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']);
    assert.deepEqual(lastNMonthAnchorsISO(1, new Date('2026-11-30T23:00:00.000Z')), ['2026-11-01T00:00:00.000Z']);
});

test('CAL-18: a range [from, to] with inclusive months is active in the month of from and to, never before or after', () => {
    const nov = monthRangeFromISO('2026-11');
    const dec = monthRangeFromISO('2026-12');
    assert.equal(isActiveInMonth(d('2026-12'), null, nov.start, nov.end), false, 'starts in December: not active in November');
    assert.equal(isActiveInMonth(d('2026-12'), null, dec.start, dec.end), true);
    assert.equal(isActiveInMonth(null, d('2026-11'), nov.start, nov.end), true, 'ends in November: active in November');
    assert.equal(isActiveInMonth(null, d('2026-11'), dec.start, dec.end), false, 'ends in November: not active in December');
    assert.equal(isActiveInMonth(null, null, dec.start, dec.end), true);
    assert.equal(isActiveInMonth(d('2026-11'), d('2026-11'), nov.start, nov.end), true);
});

test('A31: overlap of inclusive month ranges incl. open ends and single months', () => {
    const range = (from, to) => ({ fromMonth: from ? d(from) : null, toMonth: to ? d(to) : null });
    assert.equal(monthRangesOverlap(range('2026-01', '2026-11'), range('2026-12', null)), false, 'adjacent months do not overlap');
    assert.equal(monthRangesOverlap(range('2026-01', '2026-12'), range('2026-12', null)), true, 'sharing December overlaps');
    assert.equal(monthRangesOverlap(range(null, null), range('2030-01', '2030-01')), true);
    assert.equal(monthRangesOverlap(range(null, '2026-05'), range('2026-06', null)), false);
    assert.equal(monthRangesOverlap(range('2026-03', '2026-03'), range('2026-03', '2026-03')), true);
    assert.equal(monthRangesOverlap(range('2026-01', '2026-12'), range('2026-03', '2026-04')), true, 'nested');
});

test('server clock: real time by default, a frozen instant only under NODE_ENV=test', () => {
    const clock = pathToFileURL(resolve(import.meta.dirname, '../../dist/src/lib/clock.js')).href;
    const run = (env) => execFileSync(process.execPath, ['--input-type=module', '-e', `import(${JSON.stringify(clock)}).then((m) => console.log(m.now().toISOString()))`], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' }).trim();
    assert.equal(run({ NODE_ENV: 'test', TOBU_TEST_NOW: '2026-11-30T23:59:59.999Z' }), '2026-11-30T23:59:59.999Z');
    assert.notEqual(run({ NODE_ENV: 'production', TOBU_TEST_NOW: '2026-11-30T23:59:59.999Z' }), '2026-11-30T23:59:59.999Z', 'ignored in production');
    assert.throws(() => run({ NODE_ENV: 'test', TOBU_TEST_NOW: 'garbage' }));
    assert.ok(Math.abs(now().getTime() - Date.now()) < 5000);
});

test('month helpers give the same result in every process time zone (real TZ values)', () => {
    const lib = pathToFileURL(resolve(import.meta.dirname, '../../dist/src/lib/month.js')).href;
    const script = `import(${JSON.stringify(lib)}).then((m) => console.log(JSON.stringify([m.toMonthAnchorISO(new Date('2026-12-01T00:00:00.000Z')), m.lastNMonthAnchorsISO(2, new Date('2027-01-01T00:00:00.000Z')), m.monthRangeFromISO('2026-11-01T00:00:00.000Z').end.toISOString()])))`;
    const results = new Set();
    for (const zone of ['UTC', 'Europe/Berlin', 'Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Auckland'])
        results.add(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { PATH: process.env.PATH, TZ: zone }, encoding: 'utf8' }).trim());
    assert.equal(results.size, 1, [...results].join(' | '));
    assert.deepEqual(JSON.parse([...results][0]), ['2026-12-01T00:00:00.000Z', ['2026-12-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'], '2026-12-01T00:00:00.000Z']);
});
