import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { root, apiRequire } from '../lib/config.mjs';
import { temporaryDatabase } from '../lib/docker.mjs';
import { capture } from '../lib/processes.mjs';
import { ToolsBackup, inventory } from '../../apps/api/dist/src/database/migration-backup.js';
import { MigrationRunner } from '../../apps/api/dist/src/database/migration-runner.js';
import { structuralEntry } from '../../apps/api/tests/fixtures/structural-fixture.mjs';

const { MongoClient, Decimal128, Long, Binary } = apiRequire('mongodb');

test('real MongoDB Tools archive, restore drill, corruption protection and killed structural runner', { timeout: 300000 }, async () => {
    const isolated = await temporaryDatabase();
    const scratch = await mkdtemp(resolve(root, 'tmp-structural-backup-'));
    const client = new MongoClient(isolated.uri);
    let child;
    try {
        await capture(process.execPath, [resolve(root, 'apps/api/dist/src/database/cli.js'), 'init'], { env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: isolated.uri } });
        await client.connect();
        const db = client.db();
        await db.collection('original_data').insertMany([
            { _id: 'a', value: 1 },
            { _id: 'b', value: 2 }
        ]);
        await db.collection('bson_data').insertOne({ _id: 'typed', decimal: Decimal128.fromString('12.34'), integer: Long.fromString('9007199254740999'), binary: new Binary(Buffer.from([1, 2, 3])), at: new Date('2026-10-24T00:00:00Z') });
        await db.command({ collMod: 'bson_data', validator: { _id: { $type: 'string' } } });
        const backup = new ToolsBackup(client, db, isolated.uri, scratch, 'docker-local');
        const runId = randomUUID(),
            target = 'test-target';
        const original = await inventory(db);
        await backup.prepare(runId, target);
        assert.deepEqual((await backup.inspect(runId, target)).inventory, original);
        await assert.rejects(backup.inspect(runId, 'wrong-target'), /different run|Unverified/);
        const archivePath = resolve(scratch, runId, 'database.archive');
        const archive = await readFile(archivePath);
        await writeFile(archivePath, Buffer.from('corrupted'));
        await assert.rejects(backup.restore(runId, target, []), /checksum/);
        assert.deepEqual(await inventory(db), original);
        await writeFile(archivePath, archive);
        await db.collection('original_data').rename('renamed_data');
        await db.collection('bson_data').deleteMany({});
        await backup.restore(runId, target, ['original_data', 'renamed_data']);
        assert.deepEqual(await inventory(db), original);
        assert.ok(!(await readdir(resolve(scratch, runId))).some((name) => name.startsWith('connection-')));

        child = fork(resolve(root, 'apps/api/tests/fixtures/structural-child.mjs'), [], { env: { ...process.env, TEST_MONGODB_URI: isolated.uri, TEST_BACKUP_ROOT: scratch }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Structural child did not reach DDL checkpoint')), 120000);
            child.once('message', (message) => {
                clearTimeout(timer);
                assert.equal(message.renamed, true);
                resolve();
            });
            child.once('exit', (code) => {
                clearTimeout(timer);
                reject(new Error(`Structural child exited early: ${code}`));
            });
        });
        const exited = once(child, 'exit');
        child.kill('SIGKILL');
        await exited;
        child = undefined;
        const runner = new MigrationRunner(client, db, isolated.uri, 'test', [structuralEntry()], { backup });
        const plan = await runner.plan();
        assert.equal(plan.progress.steps.rename, 'started');
        await runner.recover(plan.confirmation, plan.recovery.runId, true, 'resume');
        assert.equal((await runner.plan()).applied.length, 1);
        const down = await runner.plan('down');
        await runner.run('down', down.confirmation, true);
        assert.equal(await db.collection('original_data').countDocuments(), 2);
        assert.equal(await db.collection('_tobu_migration_control').countDocuments(), 0);
    } finally {
        if (child && child.exitCode === null) {
            const exited = once(child, 'exit');
            child.kill('SIGKILL');
            await exited;
        }
        await client.close();
        await isolated.stop();
        assert.equal(dirname(scratch), resolve(root));
        await rm(scratch, { recursive: true, force: true });
    }
});
