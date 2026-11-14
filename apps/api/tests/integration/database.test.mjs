import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { initializeBaseline, verifyBaseline, schemaStatus, migrateDatabase } from '../../dist/src/database/baseline.js';
import { seedDevelopment, demoId } from '../../dist/src/database/seed.js';
import { databaseModels } from '../../dist/src/database/models.js';
import snapshot from '../../dist/src/database/baseline/2026-10-v1.json' with { type: 'json' };
import { distribute, incomeWeights } from '../../dist/src/utils/contrib.js';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { ToolsBackup } from '../../dist/src/database/migration-backup.js';

test('baseline, indexes, resumability, seeds and manual edits', { timeout: 120000 }, async (t) => {
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
    await t.test('unmarked nonempty database is refused without changes', async () => {
        await db.collection('unrelated').insertOne({ keep: true });
        await assert.rejects(initializeBaseline, /Nonempty/);
        assert.equal(await db.collection('unrelated').countDocuments(), 1);
        await db.collection('unrelated').drop();
    });
    await t.test('interrupted baseline resumes with frozen validators and indexes, never pending model DDL', async () => {
        await db.collection('_tobu_schema').insertOne({ _id: 'baseline', version: '2026-10-v1', status: 'initializing', applied: [] });
        assert.equal(await initializeBaseline(), true);
        assert.equal(await initializeBaseline(), false);
        await assert.rejects(verifyBaseline, /incompatible/);
        assert.equal((await schemaStatus()).status, 'migration-required');
        const schemas = await db.listCollections().toArray();
        for (const schema of snapshot) {
            assert.deepEqual(schemas.find((collection) => collection.name === schema.name).options.validator, schema.validator);
            const actual = await db.collection(schema.name).listIndexes().toArray();
            assert.equal(actual.length, schema.indexes.length + 1);
            for (const expected of schema.indexes)
                assert.ok(
                    actual.some((item) => JSON.stringify(item.key) === JSON.stringify(expected.key)),
                    `${schema.name}: frozen index missing`
                );
        }
        assert.equal(
            (await db.collection('events').listIndexes().toArray()).some((item) => item.name === 'accountId_1_date_-1__id_-1'),
            false,
            'model expansion must not silently alter the baseline'
        );
        await assert.rejects(() => db.collection('transactions').insertOne({ title: 'invalid' }), /validation/i);
    });
    await t.test('confirmed catalog upgrade makes the fresh database ready; repeat does not migrate again', async () => {
        assert.ok(process.env.TOBU_MIGRATION_BACKUP_DIR);
        const client = mongoose.connection.getClient();
        const runner = new MigrationRunner(client, db, uri.toString(), 'test', undefined, { backup: new ToolsBackup(client, db, uri.toString(), process.env.TOBU_MIGRATION_BACKUP_DIR, 'docker-local') });
        const plan = await runner.plan();
        assert.equal(plan.migrations.length, 1);
        await runner.run('up', plan.confirmation, true);
        const memberPlan = await runner.plan();
        assert.deepEqual(
            memberPlan.migrations.map((entry) => entry.id),
            ['20261107163516618-member-activity']
        );
        await runner.run('up', memberPlan.confirmation, true);
        const revisionPlan = await runner.plan();
        assert.deepEqual(
            revisionPlan.migrations.map((entry) => entry.id),
            ['20261107182346881-domain-writer-revisions']
        );
        await runner.run('up', revisionPlan.confirmation, true);
        const recurrenceActivityPlan = await runner.plan();
        assert.deepEqual(
            recurrenceActivityPlan.migrations.map((entry) => entry.id),
            ['20261108172127336-recurrence-activity-primitives']
        );
        await runner.run('up', recurrenceActivityPlan.confirmation, true);
        const memberLookupPlan = await runner.plan();
        assert.deepEqual(
            memberLookupPlan.migrations.map((entry) => entry.id),
            ['20261114221747317-member-user-lookup-index']
        );
        await runner.run('up', memberLookupPlan.confirmation, true);
        await verifyBaseline();
        assert.equal((await schemaStatus()).ready, true);
        assert.equal(await initializeBaseline(), false);
        assert.deepEqual((await runner.plan()).migrations, []);
    });
    await t.test('seed produces valid models, role fixtures, references and independent totals', async () => {
        await seedDevelopment('2026-04');
        assert.equal(await db.collection('users').countDocuments(), 8);
        assert.equal(await db.collection('accounts').countDocuments(), 8);
        assert.equal(await db.collection('transactions').countDocuments({ accountId: demoId('account:empty') }), 0);
        assert.equal(await db.collection('members').countDocuments({ userId: demoId('user:admin') }), 0);
        assert.equal((await db.collection('users').findOne({ _id: demoId('user:blocked') })).isActive, false);
        for (const account of await db.collection('accounts').find().toArray()) for (const membership of account.members) assert.ok(await db.collection('members').findOne({ _id: membership.memberId }));
        for (const model of databaseModels) for (const doc of await model.find()) await doc.validate();
        for (const transaction of await db.collection('transactions').find().toArray()) {
            assert.ok(await db.collection('accounts').findOne({ _id: transaction.accountId }));
            if (transaction.parentTransactionId) assert.ok(await db.collection('transactions').findOne({ _id: transaction.parentTransactionId }));
            if (transaction.categoryId) assert.ok(await db.collection('categories').findOne({ _id: transaction.categoryId, accountId: transaction.accountId }));
        }
        assert.equal((await db.collection('transactions').findOne({ title: 'Budgetvergleich 0' })).amountMinor, 12000);
        assert.equal((await db.collection('transactions').findOne({ title: 'Vorgemerkt ohne Buchungsdatum' })).bookDate, null);
        assert.equal(await db.collection('transactions').countDocuments({ title: /^Suche & Pagination/ }), 65);
        const pagination = await db
            .collection('transactions')
            .find({ title: /^Suche & Pagination/ })
            .toArray();
        assert.equal(
            pagination.reduce((sum, item) => sum + item.amountMinor, 0),
            8645
        );
        for (const name of ['member_incomes', 'contribution_rules', 'carryovers', 'account_balances', 'category_budgets', 'recurrences', 'categories']) {
            for (const item of await db.collection(name).find().toArray()) {
                const account = await db.collection('accounts').findOne({ _id: item.accountId });
                assert.ok(account, `${name}: missing account`);
                const memberIds = [item.memberId, item.createdByMemberId, item.distribution?.memberId, ...(item.distribution?.customSplit ?? []).map((split) => split.memberId)].filter(Boolean);
                for (const memberId of memberIds)
                    assert.ok(
                        account.members.some((member) => member.memberId.equals(memberId)),
                        `${name}: member outside account`
                    );
                if (item.categoryId) assert.ok(await db.collection('categories').findOne({ _id: item.categoryId, accountId: item.accountId }));
            }
        }
        const members = ['alice', 'bob', 'chris'].map((name) => String(demoId(`member:${name}`)));
        const zeroRule = await db.collection('contribution_rules').findOne({ _id: demoId('rule:zero') });
        assert.deepEqual(Object.values(distribute(zeroRule.amountMinor, zeroRule.distribution, members, incomeWeights(members, {}))), [3334, 3333, 3333]);
        const customRule = await db.collection('contribution_rules').findOne({ _id: demoId('rule:custom') });
        assert.deepEqual(Object.values(distribute(customRule.amountMinor, customRule.distribution, members.slice(0, 2), [])), [6001, 4000]);
    });
    await t.test('repeat preserves manual edits, password hashes, dates and reference month', async () => {
        const users = await db.collection('users').find().toArray();
        const count = await db.collection('transactions').countDocuments();
        await db.collection('accounts').updateOne({ _id: demoId('account:household') }, { $set: { name: 'Manuell bearbeitet' } });
        const manual = await db.collection('accounts').findOne({ _id: demoId('account:household') });
        assert.equal(await seedDevelopment(), '2026-04');
        assert.deepEqual(await db.collection('accounts').findOne({ _id: manual._id }), manual);
        assert.deepEqual(await db.collection('users').find().toArray(), users);
        assert.equal(await db.collection('transactions').countDocuments(), count);
        await assert.rejects(() => seedDevelopment('2026-05'), /reference month/);
    });
    await t.test('missing index and unknown versions are reported, never silently fixed', async () => {
        const before = await db.collection('_tobu_schema').findOne({ _id: 'baseline' });
        assert.deepEqual(await migrateDatabase(), { applied: [], pending: [] });
        assert.deepEqual(await migrateDatabase(), { applied: [], pending: [] });
        assert.deepEqual(await db.collection('_tobu_schema').findOne({ _id: 'baseline' }), before);
        const accountSchema = (await db.listCollections({ name: 'accounts' }).next()).options.validator;
        await db.command({ collMod: 'accounts', validator: {} });
        await assert.rejects(verifyBaseline, /validator/);
        await db.command({ collMod: 'accounts', validator: accountSchema });
        await db.collection('accounts').dropIndex('members.memberId_1');
        await assert.rejects(verifyBaseline, /index/);
        await db.collection('_tobu_schema').updateOne({ _id: 'baseline' }, { $set: { version: 'unknown' } });
        await assert.rejects(initializeBaseline, /Unknown/);
        await assert.rejects(migrateDatabase, /incompatible/);
    });
});
