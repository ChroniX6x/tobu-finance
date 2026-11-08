import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import mongoose from 'mongoose';
import { MongoClient, ObjectId, BSON } from 'mongodb';
import { temporaryDatabase } from '../../../../scripts/lib/docker.mjs';
import { initializeBaseline } from '../../dist/src/database/baseline.js';
import { migrations } from '../../dist/src/database/migration-catalog.js';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { ToolsBackup, inventory } from '../../dist/src/database/migration-backup.js';
import { MemoryBackup } from '../fixtures/structural-fixture.mjs';

test('E05 domain revision expansion: real eight-collection BSON, indexes, Tools and recovery', { timeout: 300000 }, async (t) => {
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
    url.pathname = `/tobu_test_e05_revision_${randomUUID().replaceAll('-', '')}`;
    const uri = url.toString();
    const client = await new MongoClient(uri).connect(),
        db = client.db();
    const scratch = await mkdtemp(join(tmpdir(), 'tobu-e05-revisions-'));
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
    const current = migrations.find((e) => e.id === '20261107182346881-domain-writer-revisions');
    const previous = migrations.filter((e) => ['20261105221750028-event-envelope', '20261107163516618-member-activity'].includes(e.id));
    assert.equal(previous.length, 2);
    assert.ok(current);
    const names = current.migration.namespaces;
    assert.equal(names.length, 8);
    const tools = () => new ToolsBackup(client, db, uri, scratch, 'docker-local');
    const runner = (entry = current, backup = new MemoryBackup(db)) => new MigrationRunner(client, db, uri, 'test', [...previous, entry], { backup });
    const execute = async (r, direction = 'up') => r.run(direction, (await r.plan(direction)).confirmation, true);
    const recover = async (r, action) => {
        const plan = await r.plan();
        return r.recover(plan.confirmation, plan.recovery.runId, true, action);
    };
    const clone = () => ({ ...current, migration: { ...current.migration, up: current.migration.up.map((s) => ({ ...s })), down: current.migration.down.map((s) => ({ ...s })) } });
    const account = new ObjectId(),
        member = new ObjectId(),
        category = new ObjectId(),
        month = new Date('2026-11-01T00:00:00.000Z');
    const save = async () => {
        const out = {};
        for (const name of [...names, 'events', 'members']) out[name] = (await db.collection(name).find().sort({ _id: 1 }).toArray()).map((d) => BSON.serialize(d).toString('hex'));
        return out;
    };
    const reset = async () => {
        await db.dropDatabase();
        await initializeBaseline();
        await db.collection('members').insertOne({ _id: member, name: 'Keep member', userId: null });
        await db.collection('accounts').insertOne({ _id: account, name: 'Keep account', currency: 'EUR', members: [{ memberId: member, role: 'member' }] });
        const values = {
            categories: { _id: category, accountId: account, name: 'Keep category', customSplit: [] },
            transactions: { accountId: account, title: 'Keep parent', type: 'expense', amountMinor: 10001, month, status: 'pending', bookDate: null, isFromSharedAccount: true, parentTransactionId: null },
            member_incomes: { accountId: account, memberId: member, amountMinor: 20003, fromMonth: month, toMonth: null },
            category_budgets: { accountId: account, categoryId: category, amountMinor: 30007, fromMonth: month, toMonth: null },
            contribution_rules: { accountId: account, type: 'additional', recurring: false, amountMinor: 111, distribution: { mode: 'perMember', memberId: member, customSplit: null }, fromMonth: month, toMonth: null },
            carryovers: { accountId: account, memberId: member, month, amountMinor: -509, reason: 'Keep private value' },
            account_balances: { accountId: account, month, closingBalanceMinor: 99991 },
            recurrences: { accountId: account, title: 'Keep legacy', type: 'expense', amountMinor: 777, schedule: { freq: 'monthly', dayOfMonth: 1 }, activeFrom: month, activeUntil: null }
        };
        for (const [name, value] of Object.entries(values)) await db.collection(name).insertOne(value);
        await db.collection('events').insertOne({ accountId: account, date: new Date('2020-01-02T12:34:56.789Z'), code: 'historical.keep', params: { keep: true }, createdByMemberId: member });
        const predecessor = new MigrationRunner(client, db, uri, 'test', previous, { backup: new MemoryBackup(db) });
        await execute(predecessor);
        await execute(predecessor);
    };
    const effective = (rows) => rows.filter((row) => names.includes(row.name)).map((row) => ({ ...row, options: { validationLevel: 'strict', validationAction: 'error', ...JSON.parse(row.options) } }));

    await t.test('actual Tools Up/Down retains all BSON, money and index definitions; no backfill', async () => {
        await reset();
        const original = await save(),
            before = effective(await inventory(db));
        const r = runner(current, tools());
        await execute(r);
        assert.deepEqual(await save(), original);
        for (const name of names) {
            assert.equal(await db.collection(name).countDocuments({ mutationVersion: { $exists: true } }), 0);
            for (const version of [-1, 0.5, null, '1']) await assert.rejects(db.collection(name).updateOne({}, { $set: { mutationVersion: version } }), /validation/i, name);
        }
        assert.deepEqual(await save(), original);
        await execute(r, 'down');
        assert.deepEqual(await save(), original);
        assert.deepEqual(effective(await inventory(db)), before);
    });
    await t.test('down preserves later valid domain revisions and user finance instead of restoring an old backup', async () => {
        await reset();
        const r = runner();
        await execute(r);
        for (const name of names) {
            await db.collection(name).updateOne({}, { $inc: { mutationVersion: 1 } });
            await db.collection(name).updateOne({}, { $inc: { mutationVersion: 1 } });
            assert.equal((await db.collection(name).findOne({})).mutationVersion, 2);
        }
        await db.collection('account_balances').updateOne({}, { $set: { closingBalanceMinor: 123457 } });
        const latest = await save();
        await execute(r, 'down');
        assert.deepEqual(await save(), latest);
        assert.equal((await db.collection('account_balances').findOne({})).closingBalanceMinor, 123457);
        assert.equal((await db.collection('transactions').findOne({})).amountMinor, 10001);
    });
    await t.test('partial DDL and failed verification resume exactly, ambiguous state and interrupted restore stay blocked', async () => {
        await reset();
        const entry = clone(),
            backup = new MemoryBackup(db),
            r = runner(entry, backup);
        const apply = entry.migration.up[3].apply;
        let applied = 0;
        entry.migration.up[3].apply = async (ctx) => {
            applied++;
            await apply(ctx);
            throw new Error('E05 fourth DDL reply lost');
        };
        const original = await save();
        await assert.rejects(execute(r), /fourth DDL reply lost/);
        entry.migration.up[3].apply = apply;
        await recover(r, 'resume');
        assert.equal(applied, 1);
        assert.deepEqual(await save(), original);
        await execute(r, 'down');
        const verify = entry.migration.up[3].verify;
        entry.migration.up[3].verify = async (ctx) => {
            await verify(ctx);
            throw new Error('E05 verification interrupted');
        };
        await assert.rejects(execute(r), /verification interrupted/);
        await db.command({ collMod: names[3], validationAction: 'warn' });
        await assert.rejects(recover(r, 'resume'), /Ambiguous/);
        backup.interruptRestore = true;
        await assert.rejects(recover(r, 'restore'), /restore interrupted/);
        assert.equal((await r.plan()).progress.stage, 'restoring');
        await assert.rejects(recover(r, 'resume'), /restore must finish/);
        await recover(r, 'restore');
        assert.deepEqual(await save(), original);
    });
    await t.test('actual Tools archive restores partial E05 DDL across all eight collections', async () => {
        await reset();
        const entry = clone(),
            original = await save();
        const apply = entry.migration.up[3].apply;
        entry.migration.up[3].apply = async (ctx) => {
            await apply(ctx);
            throw new Error('E05 actual archive restore');
        };
        const r = runner(entry, tools());
        await assert.rejects(execute(r), /actual archive restore/);
        await recover(r, 'restore');
        assert.deepEqual(await save(), original);
    });
    await t.test('process kill after four real DDL steps resumes original catalog and verified archive', async (caseT) => {
        await reset();
        const original = await save();
        const child = fork(new URL('../fixtures/domain-revisions-migration-child.mjs', import.meta.url), [], {
            env: { ...process.env, NODE_ENV: 'test', TEST_MONGODB_URI: uri, TEST_BACKUP_ROOT: scratch },
            windowsHide: true,
            stdio: ['ignore', 'inherit', 'inherit', 'ipc']
        });
        try {
            const message = await Promise.race([
                once(child, 'message', { signal: caseT.signal }),
                once(child, 'exit', { signal: caseT.signal }).then(() => {
                    throw new Error('Revision child exited before checkpoint');
                })
            ]);
            assert.equal(message[0].checkpoint, 'revision-fourth-ddl-applied-tools-stopped');
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
        assert.deepEqual((await r.plan()).applied, [...previous.map((e) => e.id), current.id]);
    });
});
