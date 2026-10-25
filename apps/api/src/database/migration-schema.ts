import { MigrationDiagnosticError } from './migration-errors.js';
import { isDeepStrictEqual } from 'node:util';
import type { Db } from 'mongodb';
import snapshot from './baseline/2026-10-v1.json' with { type: 'json' };
import type { MigrationEntry } from './migration-types.js';
import type { CollectionSchema } from './structural-types.js';

export async function verifySchema(database: Db, entries: MigrationEntry[] = [], applied: string[] = []) {
    const expected = new Map<string, CollectionSchema | null>((snapshot as CollectionSchema[]).map((item) => [item.name, item]));
    for (const id of applied) {
        const entry = entries.find((entry) => entry.id === id);
        if (!entry) throw new MigrationDiagnosticError('Missing schema migration');
        if (entry.migration.type === 'structural') for (const [name, schema] of Object.entries(entry.migration.schemaChanges)) expected.set(name, schema);
    }
    for (const [name, schema] of expected) {
        const collection = await database.listCollections({ name }, { nameOnly: false }).next();
        if (schema === null) {
            if (collection) throw new MigrationDiagnosticError(`Unexpected collection ${name}`);
            continue;
        }
        if (!collection || collection.type !== 'collection') throw new MigrationDiagnosticError(`Missing collection ${name}`);
        if (!isDeepStrictEqual(collection?.options?.validator ?? {}, schema.validator) || (collection?.options?.validationLevel ?? 'strict') !== 'strict' || (collection?.options?.validationAction ?? 'error') !== 'error')
            throw new MigrationDiagnosticError(`Missing/incompatible validator on ${name}`);
        const actual = await database.collection(name).listIndexes().toArray();
        for (const { key, ...options } of schema.indexes) {
            const found = actual.find((index) => JSON.stringify(index.key) === JSON.stringify(key));
            if (
                !found ||
                Boolean(found.unique) !== Boolean(options.unique) ||
                Boolean(found.sparse) !== Boolean(options.sparse) ||
                found.expireAfterSeconds !== options.expireAfterSeconds ||
                (options.name && found.name !== options.name) ||
                !isDeepStrictEqual(found.partialFilterExpression, options.partialFilterExpression)
            )
                throw new MigrationDiagnosticError(`Missing/incompatible index on ${name}`);
            for (const [option, value] of Object.entries(options)) {
                if (['name', 'unique', 'sparse', 'background'].includes(option)) continue;
                if (!isDeepStrictEqual(found[option], value)) throw new MigrationDiagnosticError(`Incompatible index option on ${name}`);
            }
        }
        // Changed structural definitions describe the complete expected index set (excluding _id).
        if (entries.some((entry) => applied.includes(entry.id) && entry.migration.type === 'structural' && name in entry.migration.schemaChanges)) {
            const declared = schema.indexes.filter((index) => JSON.stringify(index.key) !== '{"_id":1}');
            if (actual.filter((index) => index.name !== '_id_').length !== declared.length) throw new MigrationDiagnosticError(`Unexpected indexes on ${name}`);
        }
    }
}
