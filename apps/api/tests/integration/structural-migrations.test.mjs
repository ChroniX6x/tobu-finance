import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { initializeBaseline } from '../../dist/src/database/baseline.js';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { inventory, ToolsBackup } from '../../dist/src/database/migration-backup.js';
import { structuralEntry, MemoryBackup } from '../fixtures/structural-fixture.mjs';

test('controlled structural migration state and recovery on an isolated replica set', { timeout: 180000 }, async (t) => {
    assert.ok(process.env.TEST_MONGODB_URI);
    const url = new URL(process.env.TEST_MONGODB_URI);
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
    url.pathname = `/tobu_test_structural_${randomUUID().replaceAll('-', '')}`;
    const uri = url.toString();
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false });
    const client = await new MongoClient(uri, { monitorCommands: true }).connect(),
        db = client.db();
    t.after(async () => {
        await db.dropDatabase();
        await client.close();
        await mongoose.disconnect();
    });
    const reset = async () => {
        await db.dropDatabase();
        await initializeBaseline();
        await db.collection('original_data').insertMany([
            { _id: 'a', value: 1 },
            { _id: 'b', value: 2 }
        ]);
    };
    const execute = async (r, direction = 'up') => r.run(direction, (await r.plan(direction)).confirmation, true);
    const recover = async (r, action) => {
        const p = await r.plan();
        return r.recover(p.confirmation, p.recovery.runId, true, action);
    };
    const runner = (entry, backup, environment = 'test') => new MigrationRunner(client, db, uri, environment, [entry], { backup });

    await t.test('successful up/down with immutable history and final schema verification', async () => {
        await reset();
        const entry = structuralEntry(),
            r = runner(entry, new MemoryBackup(db));
        const commands = [];
        const listener = (event) => {
            if (['renameCollection', 'createIndexes', 'dropIndexes'].includes(event.commandName)) commands.push(event.command);
        };
        client.on('commandStarted', listener);
        await execute(r);
        assert.equal((await r.plan()).applied.length, 1);
        assert.deepEqual(await execute(r), { applied: [], pending: [] });
        await execute(r, 'down');
        client.off('commandStarted', listener);
        assert.equal(commands.length, 4);
        for (const command of commands) assert.match(command.comment, /^[a-f0-9-]{36}$/);
        assert.equal(await db.collection('original_data').countDocuments(), 2);
        assert.equal(await db.collection('_tobu_migration_control').countDocuments(), 0);
        entry.checksum = 'd'.repeat(64);
        await assert.rejects(r.plan(), /modified/);
    });
    await t.test('backup failure cannot perform the first structural write', async () => {
        await reset();
        const backup = new MemoryBackup(db);
        backup.prepare = async () => {
            throw new Error('backup failed');
        };
        const r = runner(structuralEntry(), backup);
        await assert.rejects(execute(r), /backup failed/);
        assert.equal(await db.collection('original_data').countDocuments(), 2);
        assert.equal((await r.plan()).progress.stage, 'preparing');
        await recover(r, 'restore');
        assert.equal((await r.plan()).recovery, null);
    });
    await t.test('interruption after rename resumes by inspecting state without repeating the rename', async () => {
        await reset();
        let calls = 0;
        const entry = structuralEntry({
            afterRename: () => {
                calls++;
                throw new Error('interrupted after DDL');
            }
        });
        const r = runner(entry, new MemoryBackup(db));
        await assert.rejects(execute(r), /interrupted/);
        await assert.rejects(execute(r), /locked/);
        assert.equal((await r.plan()).progress.steps.rename, 'started');
        await recover(r, 'resume');
        assert.equal(calls, 1);
        assert.equal((await r.plan()).applied.length, 1);
    });
    await t.test('ambiguous data is not retried; interrupted restore remains recoverable without schema/history', async () => {
        await reset();
        const before = await inventory(db);
        const backup = new MemoryBackup(db);
        const r = runner(
            structuralEntry({
                afterRename: () => {
                    throw new Error('interrupted');
                }
            }),
            backup
        );
        await assert.rejects(execute(r), /interrupted/);
        await db.createCollection('original_data');
        await assert.rejects(recover(r, 'resume'), /Ambiguous/);
        backup.interruptRestore = true;
        await assert.rejects(recover(r, 'restore'), /restore interrupted/);
        assert.equal((await r.plan()).progress.stage, 'restoring');
        await assert.rejects(recover(r, 'resume'), /restore must finish/);
        await recover(r, 'restore');
        // Runner metadata was created before backup and is not application data.
        assert.deepEqual(
            (await inventory(db)).filter((item) => item.name !== '_tobu_migrations'),
            before
        );
        assert.equal((await r.plan()).recovery, null);
    });
    await t.test('production acknowledgement and fresh recovery confirmation are mandatory', async () => {
        await reset();
        const entry = structuralEntry({
            afterRename: () => {
                throw new Error('interrupted');
            }
        });
        await assert.rejects(execute(runner(entry, new MemoryBackup(db), 'production')), /acknowledgement/);
        const r = runner(entry, new MemoryBackup(db));
        await assert.rejects(execute(r), /interrupted/);
        const p = await r.plan();
        await assert.rejects(r.recover('wrong', p.recovery.runId, true, 'resume'), /confirmation/);
        await assert.rejects(r.recover(p.confirmation, p.recovery.runId, true), /Choose resume/);
        await recover(r, 'restore');
    });
    await t.test('validator and interrupted multi-document transformation require verified recovery', async () => {
        await reset();
        const entry = structuralEntry();
        const validator = { value: { $type: 'number' } };
        entry.migration.schemaChanges = { original_data: { name: 'original_data', validator, indexes: [] } };
        entry.migration.up = [
            {
                id: 'transform',
                async inspect(ctx) {
                    const done = await ctx.count('original_data', { converted: true });
                    return done === 0 ? 'before' : done === 2 ? 'after' : 'ambiguous';
                },
                async apply(ctx) {
                    await ctx.validator('original_data', validator);
                    await ctx.updateMany('original_data', { _id: 'a' }, { $set: { converted: true } });
                    throw new Error('batch interrupted');
                },
                async verify(ctx) {
                    assert.equal(await ctx.count('original_data', { converted: true }), 2);
                }
            }
        ];
        const backup = new MemoryBackup(db),
            r = runner(entry, backup);
        await assert.rejects(execute(r), /batch interrupted/);
        assert.deepEqual((await db.listCollections({ name: 'original_data' }).next()).options.validator, validator);
        await assert.rejects(recover(r, 'resume'), /Ambiguous/);
        await recover(r, 'restore');
        assert.equal(await db.collection('original_data').countDocuments({ converted: true }), 0);
        assert.deepEqual((await db.listCollections({ name: 'original_data' }).next()).options.validator ?? {}, {});
    });
    await t.test('commit acknowledgement lost after success permits reconciliation, never historical restore', async () => {
        await reset();
        const r = runner(structuralEntry(), new MemoryBackup(db));
        // Inject only the release failure: the real final bookkeeping transaction commits.
        const original = db.collection.bind(db);
        db.collection = (...args) => {
            const collection = original(...args);
            if (args[0] === '_tobu_migration_control')
                collection.deleteOne = async () => {
                    throw new Error('release connection lost');
                };
            return collection;
        };
        try {
            await assert.rejects(execute(r), /release connection lost/);
        } finally {
            db.collection = original;
        }
        assert.equal((await r.plan()).progress.stage, 'succeeded');
        await assert.rejects(recover(r, 'restore'), /Committed migration/);
        await recover(r, 'resume');
        assert.equal((await r.plan()).applied.length, 1);
        assert.equal((await r.plan()).recovery, null);
    });
    await t.test('Database Tools preflight refuses populated TTL collections without changing the server', async () => {
        await reset();
        await db.collection('ttl_test').insertOne({ expires: new Date('2099-01-01T00:00:00Z') });
        await db.collection('ttl_test').createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
        const scratch = await mkdtemp(resolve(tmpdir(), 'tobu-ttl-preflight-'));
        try {
            const backup = new ToolsBackup(client, db, uri, scratch);
            await assert.rejects(backup.prepare(randomUUID(), 'ttl-test'), /TTL/);
            assert.equal((await db.admin().command({ getParameter: 1, ttlMonitorEnabled: 1 })).ttlMonitorEnabled, true);
            assert.equal(await db.collection('ttl_test').countDocuments(), 1);
        } finally {
            assert.equal(dirname(scratch), resolve(tmpdir()));
            await rm(scratch, { recursive: true, force: true });
        }
    });
});
