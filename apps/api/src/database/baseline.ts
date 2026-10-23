import mongoose from 'mongoose';
import { isDeepStrictEqual } from 'node:util';
import snapshot from './baseline/2026-10-v1.json' with { type: 'json' };
import type { IndexDescription } from 'mongodb';

export const BASELINE = '2026-10-v1';
type SchemaState = { _id: string; version: string; status: 'initializing' | 'ready'; applied: string[] };
function db() {
    if (!mongoose.connection.db) throw new Error('Database is not connected');
    return mongoose.connection.db;
}
export async function schemaStatus() {
    const database = db();
    await database.command({ ping: 1 }, { timeoutMS: 2000 });
    const state = await database.collection<SchemaState>('_tobu_schema').findOne({ _id: 'baseline' });
    return { ready: state?.status === 'ready' && state.version === BASELINE, version: state?.version ?? null, status: state?.status ?? 'uninitialized', pending: [] as string[] };
}
export async function initializeBaseline() {
    const database = db();
    const states = database.collection<SchemaState>('_tobu_schema');
    const state = await states.findOne({ _id: 'baseline' });
    if (state && state.version !== BASELINE) throw new Error('Unknown schema version; no automatic migration or reset');
    if (state?.status === 'ready') {
        await verifyBaseline();
        return false;
    }
    if (!state) {
        const collections = await database.listCollections({}, { nameOnly: true }).toArray();
        if (collections.some((c) => !c.name.startsWith('system.'))) {
            throw new Error('Nonempty/unrecognized database: refusing baseline adoption. Use a new database.');
        }
        await states.insertOne({ _id: 'baseline', version: BASELINE, status: 'initializing', applied: [] });
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
    await verifyIndexes();
    await states.updateOne({ _id: 'baseline', version: BASELINE }, { $set: { status: 'ready' } });
    return true;
}
async function verifyIndexes() {
    for (const { name, validator, indexes } of snapshot) {
        const collection = await db().listCollections({ name }, { nameOnly: false }).next();
        if (!isDeepStrictEqual(collection?.options?.validator, validator) || (collection?.options?.validationLevel ?? 'strict') !== 'strict' || (collection?.options?.validationAction ?? 'error') !== 'error') {
            throw new Error(`Missing/incompatible validator on ${name}`);
        }
        const actual = await db().collection(name).listIndexes().toArray();
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
    await verifyIndexes();
}
export async function migrateDatabase() {
    // No post-baseline migrations yet. Unknown versions must fail, never be relabelled.
    await verifyBaseline();
    return { applied: [], pending: [] };
}
