import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import mongoose from 'mongoose';
import { MongoClient, ObjectId, BSON } from 'mongodb';
import { ActivityWriteEventSchema, ACTIVITY_CODES, RECURRENCE_ACTIVITY_CODES, decodeStoredEvent, renderActivityText } from '@tobu/contracts/activity';
import { temporaryDatabase } from '../../../../scripts/lib/docker.mjs';
import { migrations } from '../../dist/src/database/migration-catalog.js';
import { initializeBaseline } from '../../dist/src/database/baseline.js';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { ToolsBackup, inventory } from '../../dist/src/database/migration-backup.js';
import { MemoryBackup } from '../fixtures/structural-fixture.mjs';
import { activitySamples } from '../fixtures/activity-samples.mjs';
import { recurrenceActivitySamples } from '../fixtures/recurrence-activity-samples.mjs';

test('E07 additive event-validator migration, retained history, actual Tools restore/recovery; no recurrence domain schema', { timeout: 300000 }, async (t) => {
    const isolated = await temporaryDatabase();
    let release = async () => {};
    t.after(async () => {
        try {
            await release();
        } finally {
            await isolated.stop();
        }
    });
    const url = new URL(isolated.uri);
    url.pathname = `/tobu_test_e07_migration_${randomUUID().replaceAll('-', '')}`;
    const uri = url.toString(),
        client = await new MongoClient(uri).connect(),
        db = client.db();
    const scratch = await mkdtemp(join(tmpdir(), 'tobu-e07-migration-'));
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false });
    release = async () => {
        try {
            await mongoose.disconnect();
            await client.close();
        } finally {
            assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
            await rm(scratch, { recursive: true, force: true });
        }
    };
    const current = migrations.find((entry) => entry.id === '20261108172127336-recurrence-activity-primitives');
    assert.ok(current);
    const base = migrations.filter((entry) => entry.id < current.id);
    assert.equal(base.at(-1).id, current.migration.predecessor);
    const tools = () => new ToolsBackup(client, db, uri, scratch, 'docker-local');
    const runner = (entry = current, backup = new MemoryBackup(db)) => new MigrationRunner(client, db, uri, 'test', [...base, entry], { backup });
    const execute = async (r, direction = 'up') => r.run(direction, (await r.plan(direction)).confirmation, true);
    const recover = async (r, action) => {
        const plan = await r.plan();
        return r.recover(plan.confirmation, plan.recovery.runId, true, action);
    };
    const ids = Object.fromEntries(
        ['account', 'user', 'transaction', 'other', 'category', 'member', 'rule', 'income', 'budget', 'carry', 'balance', 'recurrence', 'revision', 'previousRevision', 'occurrence', 'previousRecurrence', 'previousOccurrence'].map((name) => [
            name,
            new ObjectId().toHexString()
        ])
    );
    const save = async () => Object.fromEntries(await Promise.all(['events', 'members', 'transactions'].map(async (name) => [name, (await db.collection(name).find().sort({ _id: 1 }).toArray()).map((row) => BSON.serialize(row).toString('hex'))])));
    const reset = async () => {
        await db.dropDatabase();
        await initializeBaseline();
        await db.collection('events').insertOne({ accountId: new ObjectId(ids.account), date: new Date('2020-01-01T12:00:00.000Z'), code: 'historical.unknown', params: { retained: true }, createdByMemberId: null });
        await db.collection('members').insertOne({ _id: new ObjectId(ids.member), name: 'Historical', userId: null });
        await db.collection('transactions').insertOne({
            _id: new ObjectId(ids.transaction),
            accountId: new ObjectId(ids.account),
            title: 'Preserve cents',
            type: 'expense',
            amountMinor: 10001,
            month: new Date('2026-11-01T00:00:00.000Z'),
            status: 'pending',
            isFromSharedAccount: true,
            parentTransactionId: null,
            bookDate: null
        });
        const predecessors = new MigrationRunner(client, db, uri, 'test', base, { backup: new MemoryBackup(db) });
        while ((await predecessors.plan()).migrations.length) await execute(predecessors);
    };
    const clone = () => ({ ...current, migration: { ...current.migration, up: current.migration.up.map((step) => ({ ...step })), down: current.migration.down.map((step) => ({ ...step })) } });
    const row = (code, kind, id, params) => ({
        accountId: new ObjectId(ids.account),
        date: new Date('2026-11-08T12:00:00.000Z'),
        schemaVersion: 1,
        code,
        subject: { kind, id },
        params,
        actor: { kind: 'user', userId: ids.user },
        trigger: { kind: 'user_action' }
    });
    await t.test('44 independent code roundtrips and per-code actor/PII/month rejection; legacy32 remain valid and Down retains new events', async () => {
        await reset();
        const original = await save();
        const r = runner();
        await execute(r);
        assert.deepEqual(await save(), original, 'no backfill');
        const samples = { ...activitySamples(ids), 'member.updated': ['member', ids.member, { memberId: ids.member, changedFields: ['name'] }], ...recurrenceActivitySamples(ids) };
        assert.deepEqual(Object.keys(samples).sort(), [...ACTIVITY_CODES].sort());
        assert.equal(Object.keys(samples).length, 44);
        for (const [code, [kind, id, params]] of Object.entries(samples)) {
            const value = row(code, kind, id, params);
            ActivityWriteEventSchema.parse({ ...value, accountId: ids.account });
            const result = await db.collection('events').insertOne(value);
            const stored = await db.collection('events').findOne({ _id: result.insertedId });
            const decoded = decodeStoredEvent(stored);
            assert.equal(decoded.ok, true);
            assert.equal(decoded.item.code, code);
            assert.notEqual(renderActivityText(decoded.item), 'Aktivität');
            await assert.rejects(db.collection('events').insertOne({ ...value, _id: new ObjectId(), params: { ...params, notes: 'SECRET', snapshot: {} } }), (error) => error.code === 121);
            if (RECURRENCE_ACTIVITY_CODES.includes(code)) {
                const system = { ...value, _id: new ObjectId(), actor: { kind: 'system' }, trigger: { kind: 'automation' } };
                if (code === 'occurrence.generated') await db.collection('events').insertOne(system);
                else await assert.rejects(db.collection('events').insertOne(system), (error) => error.code === 121);
                if (kind === 'recurrence') await assert.rejects(db.collection('events').insertOne({ ...value, _id: new ObjectId(), subject: { kind, id: ids.other } }), (error) => error.code === 121);
                if (kind === 'occurrence') await assert.rejects(db.collection('events').insertOne({ ...value, _id: new ObjectId(), params: { ...params, occurrenceKey: '2026-13' } }), (error) => error.code === 121);
            }
        }
        assert.equal(await db.collection('events').countDocuments(), 46, 'one legacy plus44 user plus1 valid system');
        const retained = await save();
        await assert.rejects(execute(r, 'down'), /invalidate retained recurrence activity/);
        assert.deepEqual(await save(), retained);
        await recover(r, 'restore');
    });
    await t.test('real Tools Up/Down preserves later money, BSON and effective event metadata; no domain collection created', async () => {
        await reset();
        const original = await save(),
            before = await inventory(db),
            r = runner(current, tools());
        await execute(r);
        assert.deepEqual(await save(), original);
        await db.collection('transactions').updateOne({ _id: new ObjectId(ids.transaction) }, { $set: { amountMinor: 10003 } });
        const later = await save();
        await execute(r, 'down');
        assert.deepEqual(await save(), later, 'Down preserves later financial values');
        assert.equal((await db.collection('transactions').findOne({ _id: new ObjectId(ids.transaction) })).amountMinor, 10003);
        const relevant = (rows) =>
            rows.filter((item) => ['events', 'members', 'transactions'].includes(item.name)).map((item) => ({ name: item.name, indexes: item.indexes, options: { validationLevel: 'strict', validationAction: 'error', ...JSON.parse(item.options) } }));
        assert.deepEqual(relevant(await inventory(db)), relevant(before));
        assert.equal(await db.listCollections({ name: 'recurrence_occurrences' }).hasNext(), false);
    });
    await t.test('actual failed Up and Down DDL retain maintenance; original Tools archive restores exact states', async () => {
        for (const direction of ['up', 'down']) {
            await reset();
            const entry = clone();
            if (direction === 'down') await execute(runner(current, tools()));
            const original = await save();
            const apply = entry.migration[direction][0].apply;
            entry.migration[direction][0].apply = async (context) => {
                await apply(context);
                throw new Error('E07 lost DDL reply');
            };
            const r = runner(entry, tools());
            await assert.rejects(execute(r, direction), /lost DDL reply/);
            assert.ok((await r.plan()).recovery);
            await recover(r, 'restore');
            assert.deepEqual(await save(), original);
        }
    });
    await t.test('exact partial resume and ambiguous state reject; interrupted restore remains blocked until verified completion', async () => {
        await reset();
        const entry = clone(),
            backup = new MemoryBackup(db),
            verify = entry.migration.up[0].verify;
        entry.migration.up[0].verify = async (context) => {
            await verify(context);
            throw new Error('E07 verify interrupted');
        };
        const r = runner(entry, backup);
        await assert.rejects(execute(r), /verify interrupted/);
        entry.migration.up[0].verify = verify;
        await recover(r, 'resume');
        await execute(r, 'down');
        entry.migration.up[0].verify = async (context) => {
            await verify(context);
            throw new Error('E07 verify interrupted');
        };
        await assert.rejects(execute(r), /verify interrupted/);
        await db.command({ collMod: 'events', validationAction: 'warn' });
        await assert.rejects(recover(r, 'resume'), /Ambiguous/);
        backup.interruptRestore = true;
        await assert.rejects(recover(r, 'restore'), /restore interrupted/);
        assert.equal((await r.plan()).progress.stage, 'restoring');
        await assert.rejects(recover(r, 'resume'), /restore must finish/);
        await recover(r, 'restore');
        assert.equal((await r.plan()).recovery, null);
    });
    await t.test('actual process kill after validator DDL and stopped Tools resumes original source/catalog/archive', async (caseT) => {
        await reset();
        const original = await save();
        const child = fork(new URL('../fixtures/recurrence-migration-child.mjs', import.meta.url), [], {
            env: { ...process.env, NODE_ENV: 'test', TEST_MONGODB_URI: uri, TEST_BACKUP_ROOT: scratch },
            windowsHide: true,
            stdio: ['ignore', 'inherit', 'inherit', 'ipc']
        });
        try {
            const message = await Promise.race([
                once(child, 'message', { signal: caseT.signal }),
                once(child, 'exit', { signal: caseT.signal }).then(() => {
                    throw new Error('Child exited before E07 checkpoint');
                })
            ]);
            assert.equal(message[0].checkpoint, 'e07-validator-applied-tools-stopped');
        } finally {
            if (child.exitCode === null && child.signalCode === null) {
                const exited = once(child, 'exit');
                child.kill('SIGKILL');
                await exited;
            }
        }
        const r = runner(current, tools());
        await recover(r, 'resume');
        assert.deepEqual(await save(), original);
        assert.deepEqual(
            (await r.plan()).applied,
            migrations.map((entry) => entry.id)
        );
    });
});
