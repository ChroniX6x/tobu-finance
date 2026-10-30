import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { root, apiRequire } from './config.mjs';
import { capture, run } from './processes.mjs';
import { initializeLocalReplicaSet, LOCAL_REPLICA_SET } from './replica-set.mjs';
import defaults from '../../apps/api/src/database/runtime-defaults.json' with { type: 'json' };

export const MONGO_IMAGE = defaults.mongoImage;
export async function requireDocker() {
    try {
        if ((await capture('docker', ['info', '--format', '{{.OSType}}'])) !== 'linux') throw new Error('Linux containers required');
        await capture('docker', ['compose', 'version']);
    } catch {
        throw new Error('Docker engine/Compose is unavailable. Start Docker Desktop with Linux containers. No native database fallback will be used.');
    }
}
const compose = (config) => ['compose', '--project-name', config.project, '--file', resolve(root, 'infra/compose.yaml')];
export async function localContainer(config) {
    const id = await capture('docker', [...compose(config), 'ps', '--all', '--quiet', 'mongo']);
    if (!id) return null;
    if (/\s/.test(id)) throw new Error('Expected exactly one local MongoDB container');
    return JSON.parse(await capture('docker', ['inspect', id]))[0];
}
export async function assertReplicaVolume(config) {
    if (existsSync(resolve(root, 'backups/replica-set', `${config.project}.pending.json`))) throw new Error('Interrupted replica-set conversion: rerun db:replica:init with writers stopped before starting applications');
    const container = await localContainer(config);
    if (container?.Config.Cmd?.includes('--replSet')) {
        if (container.Config.Image !== MONGO_IMAGE) throw new Error('Existing MongoDB image differs; no automatic version upgrade');
        if (container.Config.Cmd.join(' ') !== `mongod --replSet ${LOCAL_REPLICA_SET} --bind_ip_all`) throw new Error('Unexpected local MongoDB command; no automatic reconfiguration');
        const volume = container.Mounts.find((mount) => mount.Destination === '/data/db');
        if (volume?.Type !== 'volume' || volume.Name !== `${config.project}_mongo-data`) throw new Error('Unexpected local MongoDB volume; startup refused');
        return;
    }
    const volumes = (await capture('docker', ['volume', 'ls', '--format', '{{.Name}}'])).split(/\r?\n/);
    if (container || volumes.includes(`${config.project}_mongo-data`)) {
        throw new Error('Existing MongoDB volume requires verified conversion. Stop all writers, then run npm run db:replica:init -- --writers-stopped=' + config.dbName);
    }
}
export async function databaseUp(config) {
    if (config.mode === 'docker') {
        await requireDocker();
        await assertReplicaVolume(config);
        await startLocalReplicaContainer(config);
    }
    await pingDatabase(config.uri);
}
export async function startLocalReplicaContainer(config) {
    if (config.mode !== 'docker') throw new Error('Only local Docker containers may be initialized');
    await run('docker', [...compose(config), 'up', '-d', '--wait', '--wait-timeout', '90'], { env: { ...process.env, DB_PORT: String(config.dbPort) } });
    await initializeLocalReplicaSet(config.uri, 'mongo:27017');
}
export async function databaseDown(config) {
    if (config.mode === 'external') {
        console.log('External database is not managed or stopped by ToBu.');
        return;
    }
    await run('docker', [...compose(config), 'stop'], { env: { ...process.env, DB_PORT: String(config.dbPort) } });
    console.log('MongoDB stopped. The persistent volume is retained.');
}
export async function pingDatabase(uri) {
    const { MongoClient } = apiRequire('mongodb');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    try {
        await client.connect();
        await client.db().command({ ping: 1 });
    } finally {
        await client.close();
    }
}
export async function temporaryDatabase(signal) {
    await requireDocker();
    signal?.throwIfAborted();
    const name = `tobu-test-${randomUUID()}`;
    try {
        // enableTestCommands only exists in this disposable test container; it allows server-side failpoints (failCommand).
        await capture('docker', ['run', '--detach', '--name', name, '--label', 'tobu.test=true', '--publish', '127.0.0.1::27017', MONGO_IMAGE, 'mongod', '--replSet', LOCAL_REPLICA_SET, '--bind_ip_all', '--setParameter', 'enableTestCommands=1']);
        signal?.throwIfAborted();
        const mapping = JSON.parse(await capture('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name]));
        const port = mapping['27017/tcp'][0].HostPort;
        const uri = `mongodb://127.0.0.1:${port}/tobu_test_${randomUUID().replaceAll('-', '')}?directConnection=true&replicaSet=${LOCAL_REPLICA_SET}`;
        await initializeLocalReplicaSet(uri, 'localhost:27017');
        for (let i = 0; i < 30; i++) {
            signal?.throwIfAborted();
            try {
                await pingDatabase(uri);
                return { uri, name, stop: () => capture('docker', ['rm', '--force', '--volumes', name]) };
            } catch {
                await delay(300);
            }
        }
        throw new Error('Temporary test MongoDB did not become ready');
    } catch (error) {
        await capture('docker', ['rm', '--force', '--volumes', name]).catch(() => {});
        throw error;
    }
}
