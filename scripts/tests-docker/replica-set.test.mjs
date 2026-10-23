import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { root, apiRoot, apiRequire } from '../lib/config.mjs';
import { capture } from '../lib/processes.mjs';
import { requireDocker, databaseUp, databaseDown, temporaryDatabase, MONGO_IMAGE } from '../lib/docker.mjs';
import { initializeLocalReplicaSet } from '../lib/replica-set.mjs';

const { MongoClient } = apiRequire('mongodb');
async function port() {
    const server = createServer().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const result = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return result;
}

test('temporary replica set supports real transaction rollback and rejects unexpected configuration', { timeout: 120000 }, async () => {
    const database = await temporaryDatabase();
    const client = new MongoClient(database.uri);
    try {
        await client.connect();
        await client.db().createCollection('atomic');
        const session = client.startSession();
        try {
            await assert.rejects(
                session.withTransaction(async () => {
                    await client.db().collection('atomic').insertOne({ value: 1 }, { session });
                    throw new Error('forced rollback');
                }),
                /forced rollback/
            );
            assert.equal(await client.db().collection('atomic').countDocuments(), 0);
            await session.withTransaction(async () => {
                await client.db().collection('atomic').insertOne({ value: 2 }, { session });
            });
            assert.equal(await client.db().collection('atomic').countDocuments(), 1);
        } finally {
            await session.endSession();
        }
        await initializeLocalReplicaSet(database.uri, 'localhost:27017');
        await assert.rejects(initializeLocalReplicaSet(database.uri, 'unexpected:27017'), /unexpected local replica set/);
    } finally {
        await client.close();
        await database.stop();
    }
});

test('existing standalone volume requires verified backup, retains manual data, and survives restart', { timeout: 240000 }, async () => {
    await requireDocker();
    const project = `tobu-conversion-test-${randomUUID()}`;
    const scratch = await mkdtemp(resolve(root, 'tmp-replica-test-'));
    const composeFile = resolve(scratch, 'compose.yaml');
    const dbPort = await port(),
        apiPort = await port(),
        webPort = await port();
    const dbName = 'tobu_test_conversion';
    const config = { mode: 'docker', project, dbPort, apiPort, webPort, dbName, uri: `mongodb://127.0.0.1:${dbPort}/${dbName}?directConnection=true&replicaSet=tobu-local` };
    const env = { ...process.env, NODE_ENV: 'test', DB_MODE: 'docker', COMPOSE_PROJECT: project, DB_PORT: String(dbPort), API_PORT: String(apiPort), WEB_PORT: String(webPort), DEV_DB_NAME: dbName };
    const compose = ['compose', '--project-name', project, '--file', composeFile];
    let client;
    try {
        await writeFile(
            composeFile,
            `services:\n  mongo:\n    image: ${MONGO_IMAGE}\n    ports: ["127.0.0.1:${dbPort}:27017"]\n    volumes: ["mongo-data:/data/db"]\n    healthcheck:\n      test: ["CMD", "mongosh", "--quiet", "--eval", "quit(db.adminCommand({ping:1}).ok ? 0 : 1)"]\n      interval: 2s\n      timeout: 3s\n      retries: 30\nvolumes:\n  mongo-data:\n`
        );
        await capture('docker', [...compose, 'up', '-d', '--wait']);
        const standalone = `mongodb://127.0.0.1:${dbPort}/${dbName}`;
        await capture(process.execPath, [resolve(apiRoot, 'dist/src/database/cli.js'), 'init'], { env: { ...env, MONGODB_URI: standalone } });
        client = new MongoClient(standalone);
        await client.connect();
        const manual = { _id: 'manual', amountMinor: 12345, at: new Date('2026-10-23T12:00:00Z') };
        await client.db().collection('manual_test_data').insertOne(manual);
        await client.db().collection('manual_test_data').createIndex({ amountMinor: 1 }, { unique: true });
        await client.close();
        await assert.rejects(databaseUp(config), /verified conversion/);
        await assert.rejects(capture(process.execPath, [resolve(root, 'scripts/initialize-replica-set.mjs')], { env }), /writers-stopped/);
        await capture(process.execPath, [resolve(root, 'scripts/initialize-replica-set.mjs'), `--writers-stopped=${dbName}`], { env });
        client = new MongoClient(config.uri);
        await client.connect();
        assert.deepEqual(await client.db().collection('manual_test_data').findOne({ _id: 'manual' }), manual);
        await client.close();
        await databaseDown(config);
        await databaseUp(config);
        client = new MongoClient(config.uri);
        await client.connect();
        assert.deepEqual(await client.db().collection('manual_test_data').findOne({ _id: 'manual' }), manual);
        const backups = resolve(root, 'backups/replica-set');
        const backupName = (await readdir(backups)).find((name) => name.startsWith(`${project}-`));
        assert.ok(backupName, 'Verified backup must remain outside the volume');
        const manifest = JSON.parse(await readFile(resolve(backups, backupName, 'manifest.json'), 'utf8'));
        assert.equal(manifest.status, 'converted-and-verified');
        const pendingPath = resolve(backups, `${project}.pending.json`);
        await writeFile(pendingPath, JSON.stringify(manifest));
        await assert.rejects(databaseUp(config), /Interrupted replica-set conversion/);
        await client
            .db()
            .collection('manual_test_data')
            .updateOne({ _id: 'manual' }, { $set: { amountMinor: 1 } });
        await assert.rejects(capture(process.execPath, [resolve(root, 'scripts/initialize-replica-set.mjs'), `--writers-stopped=${dbName}`], { env }), /Recovery data verification failed/);
        await client
            .db()
            .collection('manual_test_data')
            .updateOne({ _id: 'manual' }, { $set: { amountMinor: manual.amountMinor } });
        await capture(process.execPath, [resolve(root, 'scripts/initialize-replica-set.mjs'), `--writers-stopped=${dbName}`], { env });
        await capture(process.execPath, [resolve(root, 'scripts/initialize-replica-set.mjs'), `--writers-stopped=${dbName}`], { env });
    } finally {
        await client?.close();
        // Only this test's randomly named project/volume and scratch directory are removed.
        assert.ok(project.startsWith('tobu-conversion-test-'));
        await capture('docker', [...compose, 'down', '--volumes']);
        assert.equal(dirname(scratch), resolve(root));
        await rm(scratch, { recursive: true, force: true });
        const backups = resolve(root, 'backups/replica-set');
        for (const name of await readdir(backups).catch((error) => {
            if (error.code === 'ENOENT') return [];
            throw error;
        })) {
            if (name.startsWith(`${project}-`) || name === `${project}.pending.json`) await rm(resolve(backups, name), { recursive: true, force: true });
        }
    }
});
