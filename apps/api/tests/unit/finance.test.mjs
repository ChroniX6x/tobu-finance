import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distribute, incomeWeights } from '../../dist/src/utils/contrib.js';
import { linRegForecastNext } from '../../dist/src/utils/math.js';
import { computeChangePctFromRealSnapshots, computeReliableBalanceBlock, buildCarriedSeries } from '../../dist/src/utils/reliableBalance.js';
import { CreateTx } from '../../dist/src/validation/transactions.js';

test('income-weighted contributions preserve the amount, including rounding', () => {
  const members = ['a', 'b'];
  assert.deepEqual(distribute(30000, { mode: 'proRataIncome' }, members,
    incomeWeights(members, { a: 200000, b: 100000 })), { a: 20000, b: 10000 });
  assert.deepEqual(distribute(10001, { mode: 'customSplit', customSplit: [
    { memberId: 'a', split: 60 }, { memberId: 'b', split: 40 },
  ] }, members, []), { a: 6001, b: 4000 });
});

test('zero incomes use equal shares with deterministic remainder assignment', () => {
  const members = ['a', 'b', 'c'];
  assert.deepEqual(distribute(10000, { mode: 'proRataIncome' }, members,
    incomeWeights(members, {})), { a: 3334, b: 3333, c: 3333 });
});

test('forecast handles empty, short and linear series', () => {
  assert.equal(linRegForecastNext([]), 0);
  assert.equal(linRegForecastNext([100]), 100);
  assert.equal(linRegForecastNext([100, 125]), 150);
  assert.equal(linRegForecastNext([100, 125, 150]), 175);
});

test('balance block returns the declared currentMonth field and handles empty snapshots', () => {
  const empty = computeReliableBalanceBlock([]);
  assert.equal(empty.currentBalanceMinor, 0);
  assert.match(empty.currentMonth, /^\d{4}-\d{2}-01T00:00:00/);
  assert.equal('currentMonthIso' in empty, false);
  const snapshots = [
    { month: new Date('2020-01-01T00:00:00Z'), valueMinor: 10000 },
    { month: new Date('2020-02-01T00:00:00Z'), valueMinor: 12500 },
  ];
  assert.equal(computeChangePctFromRealSnapshots([]), 0);
  assert.equal(computeChangePctFromRealSnapshots(snapshots.slice(0, 1)), 0);
  assert.deepEqual(computeReliableBalanceBlock(snapshots), {
    currentBalanceMinor: 12500, currentMonth: '2020-02-01T00:00:00.000Z', balanceChangePct: 25,
  });
  const carried = buildCarriedSeries(snapshots, 3, new Date('2020-03-15T00:00:00Z'));
  assert.deepEqual(carried.dataMinor, [10000, 12500, 12500]);
  assert.deepEqual(carried.carried, [false, false, true]);
});

test('transaction validation distinguishes pending month and booked date', () => {
  const base = { accountId: '000000000000000000000001', title: 'Test expense',
    type: 'expense', amountMinor: 1000, isFromSharedAccount: true };
  assert.equal(CreateTx.safeParse({ ...base, month: '2026-04' }).success, true);
  assert.equal(CreateTx.safeParse(base).success, false);
  assert.equal(CreateTx.safeParse({ ...base, month: '2026-04', status: 'booked' }).success, false);
  assert.equal(CreateTx.safeParse({ ...base, status: 'booked', bookDate: '2026-04-10T00:00:00.000Z' }).success, true);
  assert.equal(CreateTx.safeParse({ ...base, month: '2026-04', amountMinor: -1 }).success, false);
  assert.equal(CreateTx.safeParse({ ...base, month: '2026-04', isFromSharedAccount: false }).success, false);
});
