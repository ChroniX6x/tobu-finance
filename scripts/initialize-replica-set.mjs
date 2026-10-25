import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { root, loadConfig, apiRequire } from './lib/config.mjs';
import { localContainer, requireDocker, databaseUp, startLocalReplicaContainer, temporaryDatabase, MONGO_IMAGE } from './lib/docker.mjs';
import { capture, assertPortFree } from './lib/processes.mjs';
import { databaseInventory } from './lib/database-inventory.mjs';

const { MongoClient } = apiRequire('mongodb');
async function hashArchive(path) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest('hex');
}
let source, probe;
try {
    if (process.env.NODE_ENV === 'production') throw new Error('Local replica-set conversion is disabled in production');
    const config = loadConfig();
    if (config.mode !== 'docker') throw new Error('External databases must be managed by their administrator');
    if (!process.argv.includes(`--writers-stopped=${config.dbName}`)) throw new Error(`Stop all writers, then pass --writers-stopped=${config.dbName}`);
    await assertPortFree(config.apiPort);
    await assertPortFree(config.webPort);
    await requireDocker();
    const pendingPath = resolve(root, 'backups/replica-set', `${config.project}.pending.json`);
    const pending = await readFile(pendingPath, 'utf8')
        .then(JSON.parse)
        .catch((error) => {
            if (error.code === 'ENOENT') return null;
            throw error;
        });
    if (pending) {
        if (pending.project !== config.project || pending.database !== config.dbName || !/^[a-f0-9-]{36}$/.test(pending.runId)) throw new Error('Invalid conversion recovery marker');
        const archive = resolve(root, 'backups/replica-set', `${config.project}-${pending.runId}`, 'database.archive');
        assert.equal(await hashArchive(archive), pending.archiveHash, 'Recovery backup checksum differs');
    }
    const container = await localContainer(config);
    if (!container || container.Config.Cmd?.includes('--replSet')) {
        if (pending) {
            if (!container || container.Config.Image !== MONGO_IMAGE) throw new Error('Recovery requires the original pinned container');
            const volume = container.Mounts.find((mount) => mount.Destination === '/data/db');
            if (volume?.Type !== 'volume' || volume.Name !== pending.volume || volume.Name !== `${config.project}_mongo-data` || container.Config.Cmd.join(' ') !== 'mongod --replSet tobu-local --bind_ip_all')
                throw new Error('Recovery container configuration differs; refusing automatic reconfiguration');
            await startLocalReplicaContainer(config);
            source = new MongoClient(config.uri);
            await source.connect();
            assert.deepEqual(await databaseInventory(source.db()), pending.before, 'Recovery data verification failed; preserve backup and keep writers stopped');
            pending.status = 'converted-and-verified';
            await writeFile(resolve(root, 'backups/replica-set', `${config.project}-${pending.runId}`, 'manifest.json'), JSON.stringify(pending, null, 2) + '\n', { mode: 0o600 });
            await rm(pendingPath);
        } else await databaseUp(config);
        console.log('Replica set ready; no standalone conversion needed.');
    } else {
        if (container.Config.Image !== MONGO_IMAGE || container.Config.Cmd?.join(' ') !== 'mongod') throw new Error('Unexpected existing MongoDB version/command; conversion refused');
        const volume = container.Mounts.find((m) => m.Destination === '/data/db');
        if (volume?.Type !== 'volume' || volume.Name !== `${config.project}_mongo-data`) throw new Error('Unexpected database volume; conversion refused');
        if (!container.State.Running) await capture('docker', ['start', container.Id]);
        const uri = new URL(config.uri);
        uri.searchParams.delete('replicaSet');
        source = new MongoClient(uri.toString(), { serverSelectionTimeoutMS: 30000 });
        await source.connect();
        const databases = (await source.db('admin').command({ listDatabases: 1, nameOnly: true })).databases;
        if (databases.some((d) => !['admin', 'config', 'local', config.dbName].includes(d.name))) throw new Error('Additional application databases found; a separate backup plan is required');
        if (await source.db('admin').collection('system.users').countDocuments()) throw new Error('Authenticated deployment requires a separate conversion plan');
        const state = await source.db().collection('_tobu_schema').findOne({ _id: 'baseline' });
        if (state?.version !== '2026-10-v1' || state.status !== 'ready') throw new Error('Only the known ready baseline can be converted');
        const before = await databaseInventory(source.db());
        if (pending) assert.deepEqual(before, pending.before, 'Source changed during interrupted conversion');
        const runId = randomUUID();
        const directory = resolve(root, 'backups', 'replica-set', `${config.project}-${runId}`);
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const archive = resolve(directory, 'database.archive');
        const remoteArchive = `/tmp/tobu-conversion-${runId}.archive`;
        await capture('docker', ['exec', container.Id, 'mongodump', '--db', config.dbName, `--archive=${remoteArchive}`]);
        await capture('docker', ['cp', `${container.Id}:${remoteArchive}`, archive]);
        assert.deepEqual(await databaseInventory(source.db()), before, 'Source changed while backing up; stop all writers');
        const archiveHash = await hashArchive(archive);
        const manifest = { runId, project: config.project, database: config.dbName, image: MONGO_IMAGE, volume: volume.Name, archiveHash, before, status: 'backup-created' };
        const record = () => writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
        await record();
        // Restore into a new owned container, never into the source or another existing database.
        probe = await temporaryDatabase();
        await capture('docker', ['cp', archive, `${probe.name}:/tmp/verify.archive`]);
        await capture('docker', ['exec', probe.name, 'mongorestore', '--archive=/tmp/verify.archive', '--stopOnError']);
        const probeUri = new URL(probe.uri);
        probeUri.pathname = `/${config.dbName}`;
        const restored = new MongoClient(probeUri.toString());
        try {
            await restored.connect();
            assert.deepEqual(await databaseInventory(restored.db()), before, 'Backup restore verification failed');
        } finally {
            await restored.close();
        }
        manifest.status = 'backup-verified';
        await record();
        await writeFile(pendingPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
        assert.deepEqual(await databaseInventory(source.db()), before, 'Source changed before conversion');
        await source.close();
        source = undefined;
        await capture('docker', ['stop', container.Id]);
        await startLocalReplicaContainer(config);
        source = new MongoClient(config.uri);
        await source.connect();
        assert.deepEqual(await databaseInventory(source.db()), before, 'Data differs after conversion; keep applications stopped and retain backup');
        manifest.status = 'converted-and-verified';
        await record();
        await rm(pendingPath);
        console.log(`Replica set converted; data and backup restore verified. Backup: ${directory}`);
    }
} catch (error) {
    console.error(error.message);
    console.error('Conversion did not complete successfully. Keep writers stopped; do not delete the volume or backup.');
    process.exitCode = 1;
} finally {
    await source?.close();
    await probe?.stop();
}
