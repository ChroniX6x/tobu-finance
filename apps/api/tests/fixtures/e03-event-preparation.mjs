// E03 tests exercise the actual immutable, catalogued migration. Clones are for fault injection only.
import { migrations } from '../../dist/src/database/migration-catalog.js';
import snapshot from '../../dist/src/database/baseline/2026-10-v1.json' with { type: 'json' };
const entry = migrations.find((item) => item.id === '20261105221750028-event-envelope');
export const before = snapshot.find((item) => item.name === 'events');
export const validator = entry.migration.schemaChanges.events.validator;
export const index = entry.migration.schemaChanges.events.indexes.find((item) => item.name === 'accountId_1_date_-1__id_-1');
export function preparationEntry() {
    return { ...entry, migration: { ...entry.migration, up: entry.migration.up.map((step) => ({ ...step })), down: entry.migration.down.map((step) => ({ ...step })) } };
}
