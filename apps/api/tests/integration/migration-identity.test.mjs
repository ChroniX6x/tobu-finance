import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoClient, BSON } from 'mongodb';
import { initializeBaseline } from '../../dist/src/database/baseline.js';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { migrationErrorMessage } from '../../dist/src/database/migration-errors.js';
import { structuralEntry, MemoryBackup } from '../fixtures/structural-fixture.mjs';
import { temporaryDatabase } from '../../../../scripts/lib/docker.mjs';
import { testAuthDatabase } from '../../../../scripts/lib/test-auth-database.mjs';

test('S1/S2 real authenticated migration identity, recovery and safe diagnostics', { timeout: 240000 }, async (t) => {
    assert.ok(process.env.TEST_MONGODB_URI);
    const isolated = await testAuthDatabase();
    let client, db;
    const users = [];
    t.after(async () => {
        try {
            if (db) {
                for (const user of users) await db.admin().command({ dropUser: user });
                await db.dropDatabase();
            }
        } finally {
            try {
                await mongoose.disconnect();
                await client?.close();
            } finally {
                await isolated.stop();
            }
        }
    });
    const url = new URL(isolated.uri);
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
    const suffix = randomUUID().replaceAll('-', '');
    url.pathname = `/tobu_test_identity_${suffix}`;
    const uri = url.toString();
    client = await new MongoClient(uri).connect();
    db = client.db();
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false });
    users.push(`e03first_${suffix}`, `e03second_${suffix}`, `e03limited_${suffix}`);
    const passwords = [randomUUID(), randomUUID(), randomUUID()];
    const authenticated = async (index, password = passwords[index]) => {
        const address = new URL(uri);
        address.username = users[index];
        address.password = password;
        address.searchParams.set('authSource', 'admin');
        const result = new MongoClient(address.toString());
        try {
            await result.connect();
            return { client: result, uri: address.toString() };
        } catch (error) {
            await result.close();
            throw error;
        }
    };
    // Users and roles exist only on this owned --auth replica set; authorization is actually enforced.
    for (let i = 0; i < users.length; i++)
        await db.admin().command({
            createUser: users[i],
            pwd: passwords[i],
            roles:
                i < 2
                    ? [{ role: 'root', db: 'admin' }]
                    : [
                          { role: 'readWrite', db: db.databaseName },
                          { role: 'dbAdmin', db: db.databaseName }
                      ]
        });
    const reset = async () => {
        await db.dropDatabase();
        await initializeBaseline();
        await db.collection('original_data').insertMany([
            { _id: 'a', value: 1 },
            { _id: 'b', value: 2 }
        ]);
    };
    const metadata = async (database = db) => {
        const result = [];
        for (const name of ['_tobu_schema', '_tobu_migration_control', '_tobu_migration_runs', '_tobu_migrations'])
            result.push([name, (await database.collection(name).find().sort({ _id: 1 }).toArray()).map((doc) => BSON.serialize(doc).toString('hex'))]);
        return result;
    };
    const copy = async (destination) => {
        for (const info of await db.listCollections().toArray()) {
            await destination.createCollection(info.name, info.options);
            const documents = await db.collection(info.name).find().toArray();
            if (documents.length) await destination.collection(info.name).insertMany(documents);
        }
    };
    const entry = () =>
        structuralEntry({
            afterRename: () => {
                throw new Error('secret-private-checkpoint');
            }
        });
    const make = (connection, definition, backup) => new MigrationRunner(connection.client, connection.client.db(), connection.uri, 'test', [definition], { backup });

    await t.test('missing identity privileges fail before lock or writes', async () => {
        await reset();
        const restricted = await authenticated(2);
        try {
            const before = await metadata();
            await assert.rejects(make(restricted, entry(), new MemoryBackup(db)).plan(), (error) => error.code === 13);
            assert.deepEqual(await metadata(), before);
        } finally {
            await restricted.client.close();
        }
    });

    await t.test('password rotation and another maintenance user recover the same target; clones and changed DB id fail closed', async () => {
        await reset();
        // Exercise the historical baseline transition as well as modern baselines.
        await db.collection('_tobu_schema').updateOne({ _id: 'baseline' }, { $unset: { databaseId: '' } });
        const first = await authenticated(0),
            backup = new MemoryBackup(db),
            definition = entry();
        let rotated, second, other;
        try {
            const r = make(first, definition, backup);
            const plan = await r.plan();
            const serialized = JSON.stringify(plan);
            for (const secret of [...users, ...passwords]) assert.ok(!serialized.includes(secret));
            let failure;
            try {
                await r.run('up', plan.confirmation, true);
            } catch (error) {
                failure = error;
            }
            assert.ok(failure);
            const diagnostic = migrationErrorMessage(failure);
            assert.match(diagnostic, /phase=apply/);
            assert.match(diagnostic, /run=/);
            assert.doesNotMatch(diagnostic, /secret-private-checkpoint/);
            const run = await db.collection('_tobu_migration_runs').findOne({});
            assert.equal(run.identityVersion, 2);
            assert.ok(run.before.databaseId);
            assert.equal((await db.collection('_tobu_schema').findOne({ _id: 'baseline' })).databaseId, run.before.databaseId);
            const newPassword = randomUUID();
            await db.admin().command({ updateUser: users[0], pwd: newPassword });
            await assert.rejects(authenticated(0), (error) => error.code === 18, 'fresh authentication with the old password is rejected');
            rotated = await authenticated(0, newPassword);
            second = await authenticated(1);
            const rotatedPlan = await make(rotated, definition, backup).plan();
            const secondPlan = await make(second, definition, backup).plan();
            assert.equal(rotatedPlan.confirmation, secondPlan.confirmation);
            assert.equal(rotatedPlan.recovery.targetHash, run.targetHash);

            await db.collection('_tobu_schema').updateOne({ _id: 'baseline' }, { $set: { databaseId: randomUUID() } });
            const changed = await metadata();
            await assert.rejects(make(rotated, definition, backup).plan(), /database identity/);
            assert.deepEqual(await metadata(), changed);
            await db.collection('_tobu_schema').updateOne({ _id: 'baseline' }, { $set: { databaseId: run.before.databaseId } });

            const cloneName = `tobu_test_clone_${suffix}`;
            const clone = client.db(cloneName);
            try {
                await copy(clone);
                const cloneUrl = new URL(uri);
                cloneUrl.pathname = `/${cloneName}`;
                const clonedClient = await new MongoClient(cloneUrl.toString()).connect();
                try {
                    const before = await metadata(clone);
                    await assert.rejects(new MigrationRunner(clonedClient, clone, cloneUrl.toString(), 'test', [definition], { backup }).plan(), /recovery journal/);
                    assert.deepEqual(await metadata(clone), before);
                } finally {
                    await clonedClient.close();
                }
            } finally {
                await clone.dropDatabase();
            }

            other = await temporaryDatabase();
            const otherUrl = new URL(other.uri);
            otherUrl.pathname = url.pathname;
            const foreign = await new MongoClient(otherUrl.toString()).connect();
            try {
                await copy(foreign.db());
                const before = await metadata(foreign.db());
                await assert.rejects(new MigrationRunner(foreign, foreign.db(), otherUrl.toString(), 'test', [definition], { backup }).plan(), /recovery journal/);
                assert.deepEqual(await metadata(foreign.db()), before);
            } finally {
                await foreign.close();
                await other.stop();
                other = undefined;
            }

            const recovery = make(second, definition, backup),
                p = await recovery.plan();
            await recovery.recover(p.confirmation, p.recovery.runId, true, 'resume');
            assert.equal((await recovery.plan()).recovery, null);
            assert.equal(await db.collection('renamed_data').countDocuments(), 2);
            assert.equal((await db.collection('_tobu_schema').findOne({ _id: 'baseline' })).databaseId, run.before.databaseId);
        } finally {
            await first.client.close();
            await rotated?.client.close();
            await second?.client.close();
            await other?.stop();
            await db.admin().command({ updateUser: users[0], pwd: passwords[0] });
        }
    });

    await t.test('legacy URI-bound journals are refused without changing locks or backup identities', async () => {
        await reset();
        const backup = new MemoryBackup(db),
            definition = entry(),
            r = new MigrationRunner(client, db, uri, 'test', [definition], { backup });
        await assert.rejects(r.run('up', (await r.plan()).confirmation, true), /secret-private-checkpoint/);
        await db.collection('_tobu_migration_control').updateOne({ _id: 'runner' }, { $unset: { identityVersion: '', targetHash: '' } });
        await db.collection('_tobu_migration_runs').updateOne({}, { $unset: { identityVersion: '' }, $set: { targetHash: 'a'.repeat(64) } });
        const before = await metadata();
        await assert.rejects(r.plan(), /Legacy migration identity/);
        assert.deepEqual(await metadata(), before);
        assert.equal(backup.saved.size, 1, 'no replacement backup or identity conversion');
    });
});
