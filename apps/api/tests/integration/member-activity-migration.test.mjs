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
import { ActivityWriteEventSchema, ACTIVITY_CODES } from '@tobu/contracts/activity';
import { activitySamples } from '../fixtures/activity-samples.mjs';

test('E05 immutable member activity/provenance migration: real schemas, data, recovery and archive', { timeout: 300000 }, async (t) => {
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
    url.pathname = `/tobu_test_e05_migration_${randomUUID().replaceAll('-', '')}`;
    const uri = url.toString();
    const client = await new MongoClient(uri).connect();
    const db = client.db();
    const scratch = await mkdtemp(join(tmpdir(), 'tobu-e05-migration-'));
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
    const predecessor = migrations.find((e) => e.id === '20261105221750028-event-envelope');
    const current = migrations.find((e) => e.id === '20261107163516618-member-activity');
    assert.ok(predecessor && current);
    const tools = () => new ToolsBackup(client, db, uri, scratch, 'docker-local');
    const runner = (entry = current, backup = new MemoryBackup(db)) => new MigrationRunner(client, db, uri, 'test', [predecessor, entry], { backup });
    const execute = async (r, direction = 'up') => r.run(direction, (await r.plan(direction)).confirmation, true);
    const recover = async (r, action) => {
        const plan = await r.plan();
        return r.recover(plan.confirmation, plan.recovery.runId, true, action);
    };
    const ids = Object.fromEntries(['account', 'transaction', 'other', 'category', 'member', 'rule', 'income', 'budget', 'carry', 'balance', 'recurrence', 'user'].map((name) => [name, new ObjectId().toHexString()]));
    const save = async () => {
        const out = {};
        for (const name of ['events', 'members', 'transactions']) out[name] = (await db.collection(name).find().sort({ _id: 1 }).toArray()).map((d) => BSON.serialize(d).toString('hex'));
        return out;
    };
    const reset = async () => {
        await db.dropDatabase();
        await initializeBaseline();
        await db.collection('members').insertOne({ _id: new ObjectId(ids.member), name: 'Historical member', userId: null, email: null });
        await db.collection('events').insertOne({ accountId: new ObjectId(ids.account), date: new Date('2020-01-01T12:34:56.789Z'), code: 'historical.unknown', params: { retained: true }, createdByMemberId: new ObjectId(ids.member) });
        await db.collection('transactions').insertOne({
            accountId: new ObjectId(ids.account),
            type: 'expense',
            amountMinor: 10001,
            month: new Date('2026-11-01T00:00:00.000Z'),
            title: 'Preserve cents',
            status: 'pending',
            isFromSharedAccount: true,
            parentTransactionId: null,
            bookDate: null
        });
        await execute(new MigrationRunner(client, db, uri, 'test', [predecessor], { backup: new MemoryBackup(db) }));
    };
    const clone = () => ({ ...current, migration: { ...current.migration, up: current.migration.up.map((s) => ({ ...s })), down: current.migration.down.map((s) => ({ ...s })) } });

    await t.test('all 32 codes roundtrip against actual expanded validator; strict provenance and privacy', async () => {
        await reset();
        const original = await save();
        const r = runner();
        await execute(r);
        assert.deepEqual(await save(), original, 'no backfill, actor reconstruction or financial change');
        const samples = { ...activitySamples(ids), 'member.updated': ['member', ids.member, { memberId: ids.member, changedFields: ['name', 'email'] }] };
        assert.deepEqual(Object.keys(samples).sort(), [...ACTIVITY_CODES].sort());
        for (const [code, [kind, id, params]] of Object.entries(samples)) {
            const row = { accountId: new ObjectId(ids.account), date: new Date('2026-11-07T12:00:00.000Z'), code, params, schemaVersion: 1, subject: { kind, id }, actor: { kind: 'user', userId: ids.user }, trigger: { kind: 'user_action' } };
            ActivityWriteEventSchema.parse({ ...row, accountId: ids.account });
            await db.collection('events').insertOne(row);
            await assert.rejects(db.collection('events').insertOne({ ...row, _id: new ObjectId(), params: { ...params, email: 'forbidden@example.test' } }), /validation/i);
        }
        assert.equal(await db.collection('events').countDocuments({ schemaVersion: 1 }), 32);
        const valid = {
            accountId: new ObjectId(ids.account),
            date: new Date(),
            code: 'member.updated',
            params: { memberId: ids.member, changedFields: ['name'] },
            schemaVersion: 1,
            subject: { kind: 'member', id: ids.member },
            actor: { kind: 'user', userId: ids.user },
            trigger: { kind: 'user_action' }
        };
        await assert.rejects(db.collection('events').insertOne({ ...valid, subject: { ...valid.subject, id: ids.other } }), /validation/i);
        await assert.rejects(db.collection('events').insertOne({ ...valid, params: { ...valid.params, changedFields: ['name', 'name'] } }), /validation/i);
        await assert.rejects(db.collection('members').updateOne({ _id: new ObjectId(ids.member) }, { $set: { createdByUserId: 'not-an-object-id' } }), /validation/i);
        const retained = await save();
        await assert.rejects(execute(r, 'down'), /invalidate retained member activity/);
        assert.deepEqual(await save(), retained);
        await recover(r, 'restore'); // preparing failed before DDL; no historical backup substitution.
    });
    await t.test('compatible Up/Down preserve BSON, collection metadata and existing finance', async () => {
        await reset();
        const original = await save();
        const before = await inventory(db);
        const r = runner(current, tools());
        await execute(r);
        assert.deepEqual(await save(), original);
        await execute(r, 'down');
        assert.deepEqual(await save(), original);
        // collMod materializes Mongo's implicit strict/error defaults; compare their effective metadata explicitly.
        const relevant = (rows) => rows.filter((row) => ['events', 'members', 'transactions'].includes(row.name)).map((row) => ({ ...row, options: { validationLevel: 'strict', validationAction: 'error', ...JSON.parse(row.options) } }));
        assert.deepEqual(relevant(await inventory(db)), relevant(before));
    });
    await t.test('real Tools archive restores a failed actual E05 partial migration without data loss', async () => {
        await reset();
        const entry = clone();
        const apply = entry.migration.up[0].apply;
        entry.migration.up[0].apply = async (ctx) => {
            await apply(ctx);
            throw new Error('E05 lost DDL reply');
        };
        const r = runner(entry, tools());
        const original = await save();
        await assert.rejects(execute(r), /lost DDL reply/);
        assert.ok((await r.plan()).recovery);
        await recover(r, 'restore');
        assert.deepEqual(await save(), original);
    });
    await t.test('step inspection resumes exact partial state, rejects ambiguity, and retains interrupted restore', async () => {
        await reset();
        const entry = clone(),
            backup = new MemoryBackup(db);
        const verify = entry.migration.up[0].verify;
        entry.migration.up[0].verify = async (ctx) => {
            await verify(ctx);
            throw new Error('E05 verify interrupted');
        };
        const r = runner(entry, backup);
        await assert.rejects(execute(r), /verify interrupted/);
        entry.migration.up[0].verify = verify;
        await recover(r, 'resume');
        await execute(r, 'down');
        entry.migration.up[0].verify = async (ctx) => {
            await verify(ctx);
            throw new Error('E05 verify interrupted');
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
    await t.test('real process kill after E05 DDL, with Tools stopped, resumes original catalog and archive', async (caseT) => {
        await reset();
        const original = await save();
        const child = fork(new URL('../fixtures/member-migration-child.mjs', import.meta.url), [], {
            env: { ...process.env, NODE_ENV: 'test', TEST_MONGODB_URI: uri, TEST_BACKUP_ROOT: scratch },
            windowsHide: true,
            stdio: ['ignore', 'inherit', 'inherit', 'ipc']
        });
        try {
            const message = await Promise.race([
                once(child, 'message', { signal: caseT.signal }),
                once(child, 'exit', { signal: caseT.signal }).then(() => {
                    throw new Error('Child exited before E05 checkpoint');
                })
            ]);
            assert.equal(message[0].checkpoint, 'e05-validator-applied-tools-stopped');
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
        assert.deepEqual((await r.plan()).applied, [predecessor.id, current.id]);
    });
});
