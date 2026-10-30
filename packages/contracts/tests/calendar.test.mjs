import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
    MonthKeySchema,
    MonthInputSchema,
    BankDateSchema,
    BankDateCarrierSchema,
    CanonicalUtcMonthAnchorSchema,
    addMonthsToMonthKey,
    bankDateFromCarrier,
    bankDateToCarrier,
    currentMonthKey,
    isBankDate,
    isBankDateCarrier,
    isMonthAnchor,
    isValidIanaTimeZone,
    monthKeyFromAnchor,
    monthKeyFromBankDate,
    monthKeyFromBankDateCarrier,
    monthKeyOfUtcDate,
    monthKeyToAnchor,
    monthKeyToAnchorIso,
    normalizeMonthInput
} from '../dist/calendar.js';
import { CreateMemberIncome, UpdateMemberIncome } from '../dist/member-incomes.js';
import { CreateCategoryBudget, UpdateCategoryBudget } from '../dist/category-budgets.js';
import { CreateContributionRule, UpdateContributionRule } from '../dist/contribution-rules.js';
import { Month } from '../dist/common.js';
import { Month as AccountMonth } from '../dist/accounts.js';

const id = '100000000000000000000001';

test('CAL-01: MonthKey maps to the exact UTC anchor, idempotently', () => {
    assert.equal(monthKeyToAnchorIso('2026-11'), '2026-11-01T00:00:00.000Z');
    const anchor = monthKeyToAnchor('2026-11');
    assert.equal(anchor.toISOString(), '2026-11-01T00:00:00.000Z');
    assert.deepEqual([anchor.getUTCDate(), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds()], [1, 0, 0, 0, 0]);
    assert.equal(monthKeyFromAnchor(anchor), '2026-11');
    assert.equal(monthKeyFromAnchor(monthKeyToAnchor(monthKeyFromAnchor(anchor))), '2026-11');
    assert.equal(normalizeMonthInput(normalizeMonthInput('2026-11')), '2026-11');
    assert.equal(CanonicalUtcMonthAnchorSchema.safeParse('2026-11-01T00:00:00.000Z').success, true);
});

test('CAL-02: results do not depend on the process time zone (real TZ variable, separate processes)', () => {
    const calendar = pathToFileURL(resolve(import.meta.dirname, '../dist/calendar.js')).href;
    const script = `import(${JSON.stringify(calendar)}).then((m) => console.log(JSON.stringify({
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localDayOfNov1Utc: new Date('2026-11-01T00:00:00.000Z').getDate(),
        anchor: m.monthKeyToAnchorIso('2026-11'),
        fromAnchor: m.monthKeyFromAnchor(m.monthKeyToAnchor('2026-11')),
        bankMonth: m.monthKeyFromBankDate('2026-11-01'),
        carrierMonth: m.monthKeyFromBankDateCarrier('2026-11-01T00:00:00.000Z'),
        carrier: m.bankDateToCarrier('2026-11-01'),
        utcMonthOfLastInstant: m.monthKeyOfUtcDate(new Date('2026-12-31T23:59:59.999Z')),
        berlinMonthAtCetBoundary: m.currentMonthKey('Europe/Berlin', new Date('2026-10-31T23:00:00.000Z')),
        tokyoMonthAtYearEnd: m.currentMonthKey('Asia/Tokyo', new Date('2026-12-31T15:00:00.000Z')),
        add: m.addMonthsToMonthKey('2026-12', 1)
    })))`;
    const results = new Map();
    for (const zone of ['UTC', 'Europe/Berlin', 'Asia/Tokyo', 'America/Los_Angeles', 'America/New_York']) {
        const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }));
        assert.equal(out.zone, zone, 'the child process must really run in the requested zone');
        results.set(zone, out);
    }
    assert.equal(results.get('America/Los_Angeles').localDayOfNov1Utc, 31, 'sanity: a naive local-date conversion WOULD shift the day here');
    const zoneIndependent = (out) => {
        const copy = { ...out };
        delete copy.zone;
        delete copy.localDayOfNov1Utc;
        return copy;
    };
    const expected = zoneIndependent(results.get('UTC'));
    assert.deepEqual(expected, {
        anchor: '2026-11-01T00:00:00.000Z',
        fromAnchor: '2026-11',
        bankMonth: '2026-11',
        carrierMonth: '2026-11',
        carrier: '2026-11-01T00:00:00.000Z',
        utcMonthOfLastInstant: '2026-12',
        berlinMonthAtCetBoundary: '2026-11',
        tokyoMonthAtYearEnd: '2027-01',
        add: '2027-01'
    });
    for (const [zone, out] of results) {
        assert.deepEqual(zoneIndependent(out), expected, `identical results in ${zone}`);
    }
});

test('CAL-03: invalid MonthKeys and month inputs are rejected', () => {
    for (const bad of ['2026-00', '2026-13', '2026-1', '', ' ', '2026-11-01', '2026-11-01T00:00:00.000Z ', '0999-01', '26-11', '2026/11', null, undefined, 202611]) {
        assert.equal(MonthKeySchema.safeParse(bad).success, false, `MonthKey ${String(bad)}`);
        assert.throws(() => monthKeyToAnchorIso(bad), RangeError);
    }
    for (const bad of ['2026-00', '2026-13', '2026-1', '', '2026-11-15', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00.000+00:00', '2026-11-01T01:00:00.000+01:00', '2026-11-01T00:00:00.001Z', '2026-11-01T12:00:00.000Z', '2026-11-02T00:00:00.000Z']) {
        assert.equal(MonthInputSchema.safeParse(bad).success, false, `month input ${bad}`);
        assert.throws(() => normalizeMonthInput(bad), RangeError);
    }
    assert.throws(() => addMonthsToMonthKey('2026-11', 1.5), RangeError);
    assert.throws(() => addMonthsToMonthKey('9999-12', 1), RangeError);
});

test('CAL-04: only the exact UTC month anchor is accepted as legacy input and normalized immediately', () => {
    assert.equal(normalizeMonthInput('2026-11-01T00:00:00.000Z'), '2026-11');
    assert.equal(normalizeMonthInput('2026-11'), '2026-11');
    assert.equal(MonthInputSchema.safeParse('2026-11-01T00:00:00.000Z').success, true);
    assert.throws(() => monthKeyFromAnchor('2026-11-02T00:00:00.000Z'), RangeError);
    assert.throws(() => monthKeyFromAnchor(new Date('2026-10-31T23:00:00.000Z')), RangeError, 'a Berlin-midnight instant is not an anchor and is never "fixed"');
    assert.throws(() => monthKeyFromAnchor(new Date('invalid')), RangeError);
});

test('CAL-05: BankDate calendar validation', () => {
    for (const ok of ['2026-02-28', '2028-02-29', '2000-02-29', '2026-12-31', '2027-01-01', '2026-04-30']) assert.equal(isBankDate(ok), true, ok);
    for (const bad of ['2026-02-29', '2100-02-29', '2026-04-31', '2026-06-31', '2026-11-00', '2026-00-10', '2026-13-01', '2026-1-1', '2026-11-1', '20261101', '2026-11-01T00:00:00.000Z', '', null]) {
        assert.equal(isBankDate(bad), false, String(bad));
        assert.equal(BankDateSchema.safeParse(bad).success, false, String(bad));
    }
    assert.equal(bankDateToCarrier('2028-02-29'), '2028-02-29T00:00:00.000Z');
    assert.equal(bankDateFromCarrier('2028-02-29T00:00:00.000Z'), '2028-02-29');
    for (const bad of ['2026-11-01T00:00:00+01:00', '2026-11-01T23:00:00.000Z', '2026-10-31T23:00:00.000Z', '2026-11-01T00:00:00Z', '2026-02-29T00:00:00.000Z', '2026-11-01']) {
        assert.equal(BankDateCarrierSchema.safeParse(bad).success, false, bad);
        assert.throws(() => bankDateFromCarrier(bad), RangeError);
    }
    assert.throws(() => bankDateToCarrier('2026-02-29'), RangeError);
    assert.equal(addMonthsToMonthKey('2026-12', 1), '2027-01');
    assert.equal(addMonthsToMonthKey('2027-01', -1), '2026-12');
    assert.equal(addMonthsToMonthKey('2026-01', -13), '2024-12');
    assert.equal(addMonthsToMonthKey('2026-11', 0), '2026-11');
});

test('CAL-07: the booking month is the BankDate calendar day (zone independence is proven in CAL-02)', () => {
    assert.equal(monthKeyFromBankDate('2026-11-01'), '2026-11');
    assert.equal(monthKeyFromBankDateCarrier('2026-11-01T00:00:00.000Z'), '2026-11');
    assert.equal(monthKeyFromBankDate('2026-10-31'), '2026-10');
    // Berlin midnight of Nov 1 is still Oct 31 in UTC; the instant helper says October, the BankDate says November.
    assert.equal(monthKeyOfUtcDate(new Date('2026-10-31T23:00:00.000Z')), '2026-10');
});

test('positive schema cases and year bounds', () => {
    for (const ok of ['1000-01', '2026-11', '9999-12']) assert.equal(MonthKeySchema.safeParse(ok).success, true, ok);
    assert.equal(BankDateSchema.safeParse('2028-02-29').success, true);
    assert.equal(BankDateCarrierSchema.safeParse('2028-02-29T00:00:00.000Z').success, true);
    assert.equal(isMonthAnchor('2026-11-01T00:00:00.000Z'), true);
    assert.equal(isMonthAnchor('2026-11-02T00:00:00.000Z'), false);
    assert.equal(isBankDateCarrier('2026-11-30T00:00:00.000Z'), true);
    assert.equal(isBankDateCarrier('2026-11-31T00:00:00.000Z'), false);
    assert.equal(monthKeyOfUtcDate(new Date('1000-01-01T00:00:00.000Z')), '1000-01');
    assert.throws(() => monthKeyOfUtcDate(new Date('0999-12-31T00:00:00.000Z')), RangeError);
    assert.throws(() => monthKeyOfUtcDate('2026-11-01'), RangeError);
    assert.throws(() => monthKeyFromAnchor(null), RangeError);
    assert.equal(addMonthsToMonthKey('1000-01', 0), '1000-01');
    assert.throws(() => addMonthsToMonthKey('1000-01', -1), RangeError);
});

test('current month of an account zone: DST, year and month boundaries, no fixed offsets', () => {
    const at = (iso) => new Date(iso);
    assert.equal(currentMonthKey('UTC', at('2026-11-30T23:59:59.999Z')), '2026-11');
    assert.equal(currentMonthKey('Europe/Berlin', at('2026-11-30T23:00:00.000Z')), '2026-12');
    assert.equal(currentMonthKey('Europe/Berlin', at('2026-11-30T22:59:59.999Z')), '2026-11');
    assert.equal(currentMonthKey('America/New_York', at('2026-12-01T04:59:59.999Z')), '2026-11');
    assert.equal(currentMonthKey('America/New_York', at('2026-12-01T05:00:00.000Z')), '2026-12');
    assert.equal(currentMonthKey('Asia/Tokyo', at('2026-12-31T15:00:00.000Z')), '2027-01');
    // DST: after the switch to winter time (2026-10-25) Berlin is UTC+1, so October ends at 23:00Z, not 22:00Z as in summer.
    assert.equal(currentMonthKey('Europe/Berlin', at('2026-10-31T22:59:59.999Z')), '2026-10');
    assert.equal(currentMonthKey('Europe/Berlin', at('2026-10-31T23:00:00.000Z')), '2026-11');
    // Summer time (switch on 2026-03-29): March ends at 22:00Z.
    assert.equal(currentMonthKey('Europe/Berlin', at('2026-09-30T21:59:59.999Z')), '2026-09');
    assert.equal(currentMonthKey('Europe/Berlin', at('2026-09-30T22:00:00.000Z')), '2026-10');
    assert.equal(currentMonthKey('Europe/Berlin', at('2026-03-31T21:59:59.999Z')), '2026-03');
    assert.equal(currentMonthKey('Europe/Berlin', at('2026-03-31T22:00:00.000Z')), '2026-04');
    assert.equal(currentMonthKey('America/Los_Angeles', at('2028-03-01T07:59:59.999Z')), '2028-02');
    assert.equal(isValidIanaTimeZone('Europe/Berlin'), true);
    for (const bad of ['', ' Europe/Berlin', 'Mars/Base', 'CET+1', '+01:00', '-05:00', null]) {
        assert.equal(isValidIanaTimeZone(bad), false, String(bad));
        assert.throws(() => currentMonthKey(bad, new Date()), RangeError);
    }
    assert.throws(() => currentMonthKey('UTC', new Date('invalid')), RangeError);
});

test('contracts: Month has one definition and income/budget/rule months accept MonthKey or exact legacy anchor only', () => {
    assert.equal(AccountMonth, Month, 'accounts.ts re-exports the common Month schema');
    assert.equal(Month.safeParse('2026-11').success, true);
    assert.equal(Month.safeParse('0000-01').success, false);
    const income = { accountId: id, memberId: id, amountMinor: 100 };
    const budget = { accountId: id, categoryId: id, amountMinor: 100 };
    const rule = { accountId: id, type: 'additional', recurring: true, amountMinor: 100, distribution: {} };
    const cases = [
        [CreateMemberIncome, income],
        [CreateCategoryBudget, budget],
        [CreateContributionRule, rule]
    ];
    for (const [schema, base] of cases) {
        for (const ok of ['2026-11', '2026-11-01T00:00:00.000Z', null, undefined]) {
            assert.equal(schema.safeParse({ ...base, fromMonth: ok, toMonth: ok }).success, true, `${String(ok)}`);
        }
        for (const bad of ['2026-13', '2026-11-15T10:00:00.000Z', '2026-11-01T00:00:00Z', '2026-11-01T01:00:00.000+01:00', '2026-11-02', '']) {
            assert.equal(schema.safeParse({ ...base, fromMonth: bad }).success, false, `from ${bad}`);
            assert.equal(schema.safeParse({ ...base, toMonth: bad }).success, false, `to ${bad}`);
        }
    }
    for (const schema of [UpdateMemberIncome, UpdateCategoryBudget, UpdateContributionRule]) {
        assert.equal(schema.safeParse({ fromMonth: '2026-11', toMonth: null }).success, true);
        assert.equal(schema.safeParse({ fromMonth: '2026-11-02' }).success, false);
        assert.equal(schema.safeParse({}).success, true, 'absent stays distinguishable from null');
        assert.equal('fromMonth' in schema.parse({}), false);
        assert.equal(schema.parse({ toMonth: null }).toMonth, null);
    }
});
