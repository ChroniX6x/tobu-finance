import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import snapshot from './baseline/2026-10-v1.json' with { type: 'json' };
import type { Db, IndexDescription } from 'mongodb';
import { BASELINE, migrationState } from './migration-state.js';
import type { SchemaState } from './migration-state.js';
import { migrations } from './migration-catalog.js';

export { BASELINE };
function db() {
    if (!mongoose.connection.db) throw new Error('Database is not connected');
    return mongoose.connection.db;
}
export async function schemaStatus() {
    const database = db();
    await database.command({ ping: 1 }, { timeoutMS: 2000 });
    const state = await database.collection<SchemaState>('_tobu_schema').findOne({ _id: 'baseline' });
    if (state?.status !== 'ready' || state.version !== BASELINE) return { ready: false, version: state?.version ?? null, status: state?.status ?? 'uninitialized', pending: [] as string[] };
    const current = await migrationState(database, migrations);
    return { ready: !current.control && current.pending.length === 0, version: state.version, status: current.control ? 'migration-recovery-required' : current.pending.length ? 'migration-required' : 'ready', pending: current.pending };
}
export async function initializeBaseline() {
    const database = db();
    const states = database.collection<SchemaState>('_tobu_schema');
    const state = await states.findOne({ _id: 'baseline' });
    if (state && state.version !== BASELINE) throw new Error('Unknown schema version; no automatic migration or reset');
    if (state?.status === 'ready') {
        const current = await migrationState(database, migrations);
        if (current.control) throw new Error('Migration recovery required before setup');
        await verifyBaselineSchema(database);
        return false;
    }
    if (!state) {
        const collections = await database.listCollections({}, { nameOnly: true }).toArray();
        if (collections.some((c) => !c.name.startsWith('system.'))) {
            throw new Error('Nonempty/unrecognized database: refusing baseline adoption. Use a new database.');
        }
        await states.insertOne({ _id: 'baseline', version: BASELINE, status: 'initializing', applied: [], databaseId: randomUUID() });
    }
    // Resumable after interruption. Never drop collections, indexes or documents.
    for (const { name, validator, indexes } of snapshot) {
        if (!(await database.listCollections({ name }).hasNext())) {
            await database.createCollection(name, { validator });
        } else {
            await database.command({ collMod: name, validator });
        }
        if (indexes.length) await database.collection(name).createIndexes(indexes as IndexDescription[]);
    }
    await verifyBaselineSchema(database);
    await states.updateOne({ _id: 'baseline', version: BASELINE }, { $set: { status: 'ready' } });
    return true;
}
export async function verifyBaselineSchema(database: Db) {
    for (const { name, validator, indexes } of snapshot) {
        const collection = await database.listCollections({ name }, { nameOnly: false }).next();
        if (!isDeepStrictEqual(collection?.options?.validator, validator) || (collection?.options?.validationLevel ?? 'strict') !== 'strict' || (collection?.options?.validationAction ?? 'error') !== 'error') {
            throw new Error(`Missing/incompatible validator on ${name}`);
        }
        const actual = await database.collection(name).listIndexes().toArray();
        for (const { key: keys, ...options } of indexes as IndexDescription[]) {
            const found = actual.find((i) => JSON.stringify(i.key) === JSON.stringify(keys));
            if (!found || Boolean(found.unique) !== Boolean(options.unique) || Boolean(found.sparse) !== Boolean(options.sparse) || found.expireAfterSeconds !== options.expireAfterSeconds) {
                throw new Error(`Missing/incompatible index on ${name}: ${JSON.stringify(keys)}`);
            }
        }
    }
}
export async function verifyBaseline() {
    if (!(await schemaStatus()).ready) throw new Error('Database not initialized or incompatible; run npm run setup / db:migrate');
    await verifyBaselineSchema(db());
}
export async function migrateDatabase() {
    // Compatibility read-only check; actual writes use the explicit migration CLI.
    await verifyBaseline();
    return { applied: [], pending: [] };
}
