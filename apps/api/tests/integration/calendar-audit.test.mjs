import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { initializeBaseline, verifyBaseline } from '../../dist/src/database/baseline.js';
import { seedDevelopment } from '../../dist/src/database/seed.js';
import { auditCalendarData } from '../../dist/src/database/calendar-audit.js';

const ANCHOR = new Date('2026-04-01T00:00:00.000Z');
const snapshot = async (db) => {
    const hash = createHash('sha256');
    for (const { name } of (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
        hash.update(name);
        for (const doc of await db.collection(name).find().sort({ _id: 1 }).toArray()) hash.update(JSON.stringify(doc));
    }
    return hash.digest('hex');
};
const count = (report, collection, check) => report.findings.find((f) => f.collection === collection && f.check === check)?.count ?? 0;

test('H05 calendar audit: fresh baseline plus seed and legacy fixtures on a real replica set, strictly read-only', { timeout: 120000 }, async (t) => {
    assert.ok(process.env.TEST_MONGODB_URI, 'Explicit isolated TEST_MONGODB_URI required');
    const uri = new URL(process.env.TEST_MONGODB_URI);
    assert.equal(uri.protocol, 'mongodb:');
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname));
    uri.pathname = `/tobu_test_${randomUUID().replaceAll('-', '')}`;
    await mongoose.connect(uri.toString(), { autoCreate: false, autoIndex: false });
    const db = mongoose.connection.db;
    t.after(async () => {
        try {
            await db.dropDatabase();
        } finally {
            await mongoose.disconnect();
        }
    });
    await initializeBaseline();
    await seedDevelopment('2026-04');
    await verifyBaseline();

    await t.test('fresh baseline plus demo seed has no calendar anomaly: NO MIGRATION', async () => {
        const before = await snapshot(db);
        const report = await auditCalendarData(db);
        assert.equal(await snapshot(db), before, 'audit must not change any document');
        for (const name of ['transactions', 'account_balances', 'carryovers', 'category_budgets', 'member_incomes', 'contribution_rules', 'recurrences']) assert.ok(report.counts[name] > 0, name);
        assert.equal(report.needsReview, 0);
        assert.deepEqual(
            report.findings.filter((f) => f.severity === 'blocking'),
            []
        );
        assert.equal(report.decision, 'NO MIGRATION');
    });

    await t.test('legacy-shaped data is classified; non-canonical bookDate needs review but is not blocking', async () => {
        const accountId = new ObjectId();
        const tx = (extra) => ({
            accountId,
            title: 'x',
            type: 'expense',
            amountMinor: 100,
            status: 'booked',
            isFromSharedAccount: true,
            month: ANCHOR,
            bookDate: new Date('2026-04-10T00:00:00.000Z'),
            categoryId: null,
            paidByMemberId: null,
            parentTransactionId: null,
            recurrenceId: null,
            ...extra
        });
        await db.collection('transactions').insertOne(tx({ bookDate: new Date('2026-04-10T22:00:00.000Z') }));
        const tolerated = await auditCalendarData(db);
        assert.equal(count(tolerated, 'transactions', 'bookDate:not-utc-midnight-carrier'), 1);
        assert.equal(tolerated.blocking, 0);
        assert.equal(tolerated.needsReview, 1);
        assert.equal(tolerated.decision, 'REVIEW');
    });

    await t.test('anomalies that need a migration decision yield STOP-DATA, counts only', async () => {
        const accountId = new ObjectId();
        const parentId = new ObjectId();
        const base = { accountId, title: 'secret-title', type: 'expense', amountMinor: 987654, isFromSharedAccount: true, categoryId: null, paidByMemberId: null, recurrenceId: null };
        const opts = { bypassDocumentValidation: true };
        await db.collection('transactions').insertMany(
            [
                { ...base, month: new Date('2026-04-15T00:00:00.000Z'), bookDate: null, status: 'pending', parentTransactionId: null },
                { ...base, month: ANCHOR, bookDate: new Date('2026-05-03T00:00:00.000Z'), status: 'booked', parentTransactionId: null },
                { ...base, month: ANCHOR, bookDate: null, status: 'booked', parentTransactionId: null },
                { ...base, _id: parentId, month: ANCHOR, bookDate: new Date('2026-04-02T00:00:00.000Z'), status: 'booked', parentTransactionId: null },
                { ...base, month: ANCHOR, bookDate: new Date('2026-04-03T00:00:00.000Z'), status: 'booked', parentTransactionId: parentId },
                { ...base, month: ANCHOR, bookDate: null, status: 'pending', parentTransactionId: new ObjectId() },
                { ...base, month: ANCHOR, bookDate: new Date('2026-05-04T00:00:00.000Z'), status: 'pending', parentTransactionId: null },
                { ...base, month: new Date('2026-05-01T00:00:00.000Z'), bookDate: new Date('2026-04-02T00:00:00.000Z'), status: 'booked', parentTransactionId: parentId }
            ],
            opts
        );
        await db.collection('account_balances').insertOne({ accountId, month: new Date('2026-04-02T00:00:00.000Z') }, opts);
        await db.collection('events').insertOne({ accountId, date: '2026-04-02' }, opts);
        await db.collection('member_incomes').insertOne({ accountId, fromMonth: new Date('2026-06-01T00:00:00.000Z'), toMonth: ANCHOR }, opts);
        const before = await snapshot(db);
        const report = await auditCalendarData(db);
        assert.equal(await snapshot(db), before);
        assert.equal(count(report, 'transactions', 'month:not-utc-month-anchor'), 1);
        assert.equal(count(report, 'transactions', 'booked:month-contradicts-bookDate'), 2);
        assert.equal(count(report, 'transactions', 'booked:without-bookDate'), 1);
        assert.equal(count(report, 'transactions', 'child:bookDate-differs-from-parent'), 1);
        assert.equal(count(report, 'transactions', 'child:orphan-parent'), 1);
        assert.equal(count(report, 'transactions', 'pending:month-contradicts-bookDate'), 1);
        assert.equal(count(report, 'transactions', 'child:month-differs-from-parent'), 1);
        assert.equal(count(report, 'events', 'date:not-a-date'), 1);
        assert.equal(count(report, 'account_balances', 'month:not-utc-month-anchor'), 1);
        assert.equal(count(report, 'member_incomes', 'range:from-after-to'), 1);
        assert.equal(report.decision, 'STOP-DATA');
        await db.collection('recurrences').insertOne({ activeFrom: new Date('2026-06-01T00:00:00.000Z'), activeUntil: ANCHOR }, opts);
        assert.equal(count(await auditCalendarData(db), 'recurrences', 'range:from-after-until'), 1);
        const cli = spawnSync(process.execPath, [fileURLToPath(new URL('../../dist/src/database/cli.js', import.meta.url)), 'audit-calendar'], { env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri.toString() }, encoding: 'utf8' });
        assert.equal(cli.status, 2);
        assert.equal(JSON.parse(cli.stdout).decision, 'STOP-DATA');
        const serialized = JSON.stringify(report);
        assert.ok(!serialized.includes('secret-title') && !serialized.includes('987654') && !serialized.includes(accountId.toString()));
    });
});
