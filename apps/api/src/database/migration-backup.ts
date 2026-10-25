import { MigrationDiagnosticError } from './migration-errors.js';
import { BSON, type Db, type MongoClient } from 'mongodb';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isDeepStrictEqual } from 'node:util';
import defaults from './runtime-defaults.json' with { type: 'json' };

export const OPERATIONAL = ['_tobu_migration_control', '_tobu_migration_runs', '_tobu_restore_owner'];
export type Inventory = Awaited<ReturnType<typeof inventory>>;
export interface BackupManifest {
    runId: string;
    targetHash: string;
    digest: string;
    inventory: Inventory;
    serverVersion: string;
    verified: true;
}
export interface MigrationBackup {
    prepare(runId: string, targetHash: string): Promise<void>;
    inspect(runId: string, targetHash: string): Promise<BackupManifest>;
    restore(runId: string, targetHash: string, namespaces: string[]): Promise<void>;
}

export async function inventory(db: Db) {
    const result = [];
    for (const info of (await db.listCollections({}, { nameOnly: false }).toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
        if (OPERATIONAL.includes(info.name)) continue;
        if (info.type !== 'collection' || info.name.startsWith('system.') || info.options?.timeseries || info.options?.encryptedFields || info.options?.capped)
            throw new MigrationDiagnosticError('Backup strategy does not support this collection type');
        const collection = db.collection(info.name);
        const hash = createHash('sha256');
        let count = 0;
        for await (const doc of collection.find({}, { sort: { _id: 1 }, promoteValues: false, bsonRegExp: true })) {
            hash.update(BSON.serialize(doc));
            count++;
        }
        const indexes = (await collection.listIndexes().toArray())
            .map((index) => {
                delete index.v;
                delete index.ns;
                return index;
            })
            .sort((a, b) => a.name!.localeCompare(b.name!));
        result.push({ name: info.name, count, digest: hash.digest('hex'), options: BSON.EJSON.stringify(info.options, { relaxed: false }), indexes: BSON.EJSON.stringify(indexes, { relaxed: false }) });
    }
    return result;
}

const execute = promisify(execFile);
async function fileDigest(path: string) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest('hex');
}
const same = (a: unknown, b: unknown, message: string) => {
    if (!isDeepStrictEqual(a, b)) throw new MigrationDiagnosticError(message);
};

// Database Tools provide BSON/metadata serialization. This class only orchestrates and verifies.
export class ToolsBackup implements MigrationBackup {
    constructor(
        private client: MongoClient,
        private db: Db,
        private uri: string,
        private root: string,
        private mode: 'native' | 'docker-local' = 'native'
    ) {
        if (!isAbsolute(root) || !/^[a-zA-Z0-9_-]+$/.test(db.databaseName)) throw new MigrationDiagnosticError('Absolute protected backup directory and simple explicit DB name required');
    }
    private directory(runId: string) {
        if (!/^[a-f0-9-]{36}$/.test(runId)) throw new MigrationDiagnosticError('Invalid backup run ID');
        return resolve(this.root, runId);
    }
    private async checkDirectory(runId: string, targetHash: string) {
        const directory = this.directory(runId);
        if (dirname(await realpath(directory)) !== (await realpath(this.root))) throw new MigrationDiagnosticError('Backup directory escaped its root');
        same(JSON.parse(await readFile(resolve(directory, 'owner.json'), 'utf8')), { runId, targetHash }, 'Backup belongs to a different run/target');
        return directory;
    }
    private async tool(command: 'mongodump' | 'mongorestore', runId: string, args: string[]) {
        const directory = this.directory(runId);
        const name = `connection-${randomUUID()}.json`;
        let uri = this.uri;
        let container: string | undefined;
        if (this.mode === 'docker-local') {
            const parsed = new URL(uri);
            if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.username || parsed.password)
                throw new MigrationDiagnosticError('Docker helper is only for the explicitly selected local development connection');
            const ids = (await execute('docker', ['ps', '--format', '{{.ID}}'], { windowsHide: true })).stdout.trim().split(/\s+/).filter(Boolean);
            const matches: string[] = [];
            for (const id of ids) {
                const data = JSON.parse((await execute('docker', ['inspect', id], { windowsHide: true })).stdout)[0];
                if (data.State.Running && data.NetworkSettings.Ports['27017/tcp']?.some((mapping: { HostIp: string; HostPort: string }) => mapping.HostIp === '127.0.0.1' && mapping.HostPort === (parsed.port || '27017'))) matches.push(data.Id);
            }
            if (matches.length !== 1) throw new MigrationDiagnosticError('Cannot identify the explicitly selected local MongoDB container');
            container = matches[0];
            parsed.hostname = '127.0.0.1';
            parsed.port = '27017';
            uri = parsed.toString();
        }
        // All tools are tagged for recovery's in-flight-operation check. URI/password never in argv.
        const separator = uri.indexOf('?');
        const base = separator < 0 ? uri : uri.slice(0, separator);
        const query = new URLSearchParams(separator < 0 ? '' : uri.slice(separator + 1));
        query.set('appName', `tobu-migration-${runId}`);
        uri = `${base}?${query}`;
        const path = resolve(directory, name);
        await writeFile(path, JSON.stringify({ uri }), { mode: 0o600, flag: 'wx' });
        try {
            const toolArgs = [`--config=${this.mode === 'native' ? path : `/backup/${name}`}`, '--quiet', ...args];
            if (this.mode === 'native') await execute(command, toolArgs, { cwd: directory, windowsHide: true, maxBuffer: 1024 * 1024 });
            else
                await execute('docker', ['run', '--rm', '--network', `container:${container}`, '--mount', `type=bind,source=${directory},target=/backup`, '--workdir', '/backup', defaults.mongoImage, command, ...toolArgs], {
                    windowsHide: true,
                    maxBuffer: 1024 * 1024
                });
        } catch {
            throw new MigrationDiagnosticError(`Database tool ${command} failed; keep maintenance active and inspect tool availability/permissions`);
        } finally {
            await rm(path, { force: true });
        }
    }
    async inspect(runId: string, targetHash: string) {
        const directory = await this.checkDirectory(runId, targetHash);
        const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')) as BackupManifest;
        if (manifest.runId !== runId || manifest.targetHash !== targetHash || manifest.verified !== true || !Array.isArray(manifest.inventory)) throw new MigrationDiagnosticError('Unverified backup');
        if ((await fileDigest(resolve(directory, 'database.archive'))) !== manifest.digest) throw new MigrationDiagnosticError('Backup archive checksum mismatch');
        const version = String((await this.db.admin().command({ buildInfo: 1 })).version);
        if (version !== manifest.serverVersion) throw new MigrationDiagnosticError('Server version changed since backup; deployment-specific restore review required');
        return manifest;
    }
    private async probe(runId: string, expected: Inventory) {
        const name = `tobu_restore_${runId.replaceAll('-', '')}`;
        if (name === this.db.databaseName) throw new MigrationDiagnosticError('Restore probe must not use the source');
        const probe = this.client.db(name);
        const collections = await probe.listCollections({}, { nameOnly: true }).toArray();
        if (collections.length) {
            const owner = await probe.collection<{ _id: string; runId: string }>('_tobu_restore_owner').findOne({ _id: 'owner' });
            if (owner?.runId !== runId) throw new MigrationDiagnosticError('Restore probe database is not owned by this run');
            await probe.command({ dropDatabase: 1, comment: runId, writeConcern: { w: 'majority' } });
        }
        await probe.collection<{ _id: string; runId: string }>('_tobu_restore_owner').insertOne({ _id: 'owner', runId });
        try {
            await this.tool('mongorestore', runId, ['--archive=database.archive', '--stopOnError', `--nsInclude=${this.db.databaseName}.*`, `--nsFrom=${this.db.databaseName}.*`, `--nsTo=${name}.*`]);
            same(await inventory(probe), expected, 'Backup restore probe differs from original data/metadata');
        } finally {
            const owner = await probe.collection<{ _id: string; runId: string }>('_tobu_restore_owner').findOne({ _id: 'owner' });
            if (owner?.runId === runId) await probe.command({ dropDatabase: 1, comment: runId, writeConcern: { w: 'majority' } });
        }
    }
    async prepare(runId: string, targetHash: string) {
        const hello = await this.db.admin().command({ hello: 1 });
        if (hello.msg === 'isdbgrid') throw new MigrationDiagnosticError('Sharded structural migration needs a deployment-specific backup strategy');
        const directory = this.directory(runId);
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        try {
            await mkdir(directory, { mode: 0o700 });
            await writeFile(resolve(directory, 'owner.json'), JSON.stringify({ runId, targetHash }), { mode: 0o600, flag: 'wx' });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
        await this.checkDirectory(runId, targetHash);
        for (const info of await this.db.listCollections({}, { nameOnly: true }).toArray()) {
            if (OPERATIONAL.includes(info.name)) continue;
            const indexes = await this.db
                .collection(info.name)
                .listSearchIndexes()
                .toArray()
                .catch((error: { codeName?: string; code?: number }) => {
                    if (error.codeName === 'SearchNotEnabled' || error.code === 40324) return [];
                    throw new MigrationDiagnosticError('Unable to verify absence of unsupported Search indexes');
                });
            if (indexes.length) throw new MigrationDiagnosticError('Search indexes require another backup strategy');
        }
        const before = await inventory(this.db);
        // TTL is an independent writer, even with every application stopped.
        // Never change a shared server parameter implicitly (Atlas may forbid it).
        for (const item of before) {
            if (item.count && (BSON.EJSON.parse(item.indexes) as { expireAfterSeconds?: number }[]).some((index) => index.expireAfterSeconds !== undefined)) {
                const parameters = await this.db.admin().command({ getParameter: 1, ttlMonitorEnabled: 1 });
                if (parameters.ttlMonitorEnabled !== false) throw new MigrationDiagnosticError('Populated TTL collection requires a controlled TTL pause or another backup strategy');
            }
        }
        await this.tool('mongodump', runId, [`--db=${this.db.databaseName}`, '--archive=database.archive', ...OPERATIONAL.map((name) => `--excludeCollection=${name}`)]);
        same(await inventory(this.db), before, 'Writers changed the source during backup (including TTL); aborting');
        await this.probe(runId, before);
        same(await inventory(this.db), before, 'Source changed during restore verification');
        const manifest: BackupManifest = { runId, targetHash, inventory: before, digest: await fileDigest(resolve(directory, 'database.archive')), serverVersion: String((await this.db.admin().command({ buildInfo: 1 })).version), verified: true };
        await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    }
    async restore(runId: string, targetHash: string, namespaces: string[]) {
        const manifest = await this.inspect(runId, targetHash);
        // Re-test recoverability before the first destructive operation, including interrupted restores.
        await this.probe(runId, manifest.inventory);
        const original = new Set(manifest.inventory.map((item) => item.name));
        const current = await this.db.listCollections({}, { nameOnly: true }).toArray();
        for (const item of current) if (!OPERATIONAL.includes(item.name) && !original.has(item.name) && !namespaces.includes(item.name)) throw new MigrationDiagnosticError('Unexpected namespace outside the migration; refusing restore');
        for (const item of current) if (!OPERATIONAL.includes(item.name)) await this.db.command({ drop: item.name, comment: runId, writeConcern: { w: 'majority' } });
        await this.tool('mongorestore', runId, ['--archive=database.archive', '--stopOnError', `--nsInclude=${this.db.databaseName}.*`]);
        same(await inventory(this.db), manifest.inventory, 'Restored source differs from verified backup; maintenance retained');
    }
}
