import assert from 'node:assert/strict';
import { test } from 'node:test';
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

test('P02 nonunique member lookup migration: real Tools archive, BSON, up/down, interrupted reply and ambiguity', { timeout: 300000 }, async (t) => {
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
    url.pathname = `/tobu_test_p02_index_${randomUUID().replaceAll('-', '')}`;
    const uri = url.toString();
    const client = await new MongoClient(uri).connect();
    const db = client.db();
    const scratch = await mkdtemp(join(tmpdir(), 'tobu-p02-index-'));
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
    const current = migrations.find((entry) => entry.id === '20261114221747317-member-user-lookup-index');
    assert.ok(current);
    const base = migrations.filter((entry) => entry.id < current.id);
    const execute = async (r, direction = 'up') => r.run(direction, (await r.plan(direction)).confirmation, true);
    const recover = async (r, action) => {
        const plan = await r.plan();
        return r.recover(plan.confirmation, plan.recovery.runId, true, action);
    };
    const runner = (entry = current, backup = new MemoryBackup(db)) => new MigrationRunner(client, db, uri, 'test', [...base, entry], { backup });
    const tools = () => new ToolsBackup(client, db, uri, scratch, 'docker-local');
    const save = async () => (await db.collection('members').find().sort({ _id: 1 }).toArray()).map((row) => BSON.serialize(row).toString('hex'));
    const reset = async () => {
        await db.dropDatabase();
        await initializeBaseline();
        const r = new MigrationRunner(client, db, uri, 'test', base, { backup: new MemoryBackup(db) });
        while ((await r.plan()).migrations.length) await execute(r);
        const userId = new ObjectId();
        await db.collection('members').insertMany([
            { _id: new ObjectId(), name: 'Same registered person A', userId },
            { _id: new ObjectId(), name: 'Same registered person B', userId },
            { _id: new ObjectId(), name: 'Unlinked historical', userId: null },
            { _id: new ObjectId(), name: 'No user field' }
        ]);
    };
    const clone = () => ({ ...current, migration: { ...current.migration, up: current.migration.up.map((step) => ({ ...step })) } });
    await t.test('up/down retain duplicate identities and byte-exact data; index serves lookup', async () => {
        await reset();
        const before = await save();
        const metadata = (await inventory(db)).filter((row) => !row.name.startsWith('_tobu'));
        const r = runner(current, tools());
        await execute(r);
        assert.deepEqual(await save(), before);
        const index = (await db.collection('members').indexes()).find((row) => row.name === 'userId_1');
        assert.deepEqual(index.key, { userId: 1 });
        assert.equal(index.unique, undefined);
        const duplicate = await db.collection('members').findOne({ name: 'Same registered person A' });
        assert.equal(await db.collection('members').countDocuments({ userId: duplicate.userId }, { hint: 'userId_1' }), 2);
        await execute(r, 'down');
        assert.deepEqual(await save(), before);
        assert.deepEqual(
            (await inventory(db)).filter((row) => !row.name.startsWith('_tobu')),
            metadata
        );
    });
    await t.test('lost DDL reply resumes by read-only inspection, without repeat DDL', async () => {
        await reset();
        const before = await save();
        const entry = clone();
        const apply = entry.migration.up[0].apply;
        let writes = 0;
        entry.migration.up[0].apply = async (ctx) => {
            writes++;
            await apply(ctx);
            throw new Error('P02 lost index reply');
        };
        const r = runner(entry);
        await assert.rejects(execute(r), /lost index reply/);
        await recover(r, 'resume');
        assert.equal(writes, 1);
        assert.deepEqual(await save(), before);
    });
    await t.test('ambiguous index refuses resume; actual Tools restore recovers original schema and BSON', async () => {
        await reset();
        const before = await save();
        const metadata = await inventory(db);
        const entry = clone();
        const apply = entry.migration.up[0].apply;
        entry.migration.up[0].apply = async (ctx) => {
            await apply(ctx);
            throw new Error('P02 interrupt');
        };
        const r = runner(entry, tools());
        await assert.rejects(execute(r), /P02 interrupt/);
        await db.collection('members').createIndex({ name: 1 }, { name: 'unexpected_index' });
        await assert.rejects(recover(r, 'resume'), /ambiguous|Unexpected/i);
        await recover(r, 'restore');
        assert.deepEqual(await save(), before);
        assert.deepEqual(await inventory(db), metadata);
    });
});
