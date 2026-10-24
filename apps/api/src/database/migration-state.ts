import type { ClientSession, Db } from 'mongodb';
import type { MigrationEntry } from './migration-types.js';

export const BASELINE = '2026-10-v1';
export type SchemaState = { _id: string; version: string; status: 'initializing' | 'ready'; applied: string[]; databaseId?: string };
export type History = { _id: string; checksum: string; applied: boolean; runId: string };
export type Control = { _id: string; runId: string; migration: string; direction: 'up' | 'down'; status: 'running' | 'committed'; startedAt: Date; kind?: 'structural'; owner?: string };

export function validateCatalog(entries: MigrationEntry[]) {
    const ids = new Set<string>();
    entries.forEach((entry, index) => {
        if (!/^\d{17}-[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id) || !/^[a-f0-9]{64}$/.test(entry.checksum)) throw new Error('Invalid/duplicate migration identity');
        ids.add(entry.id);
        const migration = entry.migration;
        if (!['transactional', 'structural'].includes(migration.type)) throw new Error('Unknown migration type');
        if (migration.predecessor !== (entries[index - 1]?.id ?? BASELINE)) throw new Error('Invalid migration predecessor chain');
        if (!migration.description || !migration.namespaces.length || migration.namespaces.some((name) => !/^[a-z][a-z0-9_]*$/.test(name) || name.startsWith('system'))) throw new Error('Migration description/namespaces required');
        for (const method of ['preUp', 'verifyUp', 'preDown', 'verifyDown'] as const) if (typeof migration[method] !== 'function') throw new Error(`Missing migration method: ${method}`);
        if (migration.type === 'transactional') {
            if (typeof migration.up !== 'function' || typeof migration.down !== 'function') throw new Error('Missing up/down');
        } else {
            if (!migration.schemaChanges || Object.entries(migration.schemaChanges).some(([name, schema]) => !migration.namespaces.includes(name) || (schema !== null && (schema.name !== name || !schema.validator || !Array.isArray(schema.indexes)))))
                throw new Error('Invalid structural schema changes');
            for (const steps of [migration.up, migration.down]) {
                if (!Array.isArray(steps) || !steps.length || new Set(steps.map((step) => step.id)).size !== steps.length) throw new Error('Unique nonempty structural steps required');
                for (const step of steps) if (!/^[a-z][a-z0-9-]*$/.test(step.id) || typeof step.inspect !== 'function' || typeof step.apply !== 'function' || typeof step.verify !== 'function') throw new Error('Invalid structural step');
            }
        }
    });
}

export async function migrationState(db: Db, entries: MigrationEntry[], session?: ClientSession) {
    validateCatalog(entries);
    const options = session ? { session } : {};
    const state = await db.collection<SchemaState>('_tobu_schema').findOne({ _id: 'baseline' }, options);
    if (!state || state.version !== BASELINE || state.status !== 'ready' || !Array.isArray(state.applied)) throw new Error('Database baseline is uninitialized or incompatible');
    const history = await db.collection<History>('_tobu_migrations').find({}, options).toArray();
    for (const record of history) {
        const entry = entries.find((entry) => entry.id === record._id);
        if (!entry || entry.checksum !== record.checksum || typeof record.applied !== 'boolean') throw new Error('Missing or modified migration/history');
    }
    const applied = entries.filter((entry) => history.some((record) => record._id === entry.id && record.applied)).map((entry) => entry.id);
    if (JSON.stringify(applied) !== JSON.stringify(state.applied) || applied.some((id, index) => id !== entries[index]?.id)) throw new Error('Migration history and schema state disagree');
    const control = await db.collection<Control>('_tobu_migration_control').findOne({ _id: 'runner' }, options);
    return { state, history, applied, pending: entries.slice(applied.length).map((entry) => entry.id), control };
}
