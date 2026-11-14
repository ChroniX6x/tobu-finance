import assert from 'node:assert/strict';
import { test } from 'node:test';
import snapshot from '../../dist/src/database/baseline/2026-10-v1.json' with { type: 'json' };
import { databaseModels } from '../../dist/src/database/models.js';
import { migrations } from '../../dist/src/database/migration-catalog.js';

test('frozen baseline plus explicit additive E03/E05/E07 changes represents current models and migrated validators', () => {
    // When models evolve, replace this comparison with the expected migrated schema test.
    // Never regenerate the historical snapshot to make a future model change pass.
    const current = databaseModels.map((model) => ({ name: model.collection.name, validator: { $jsonSchema: model.schema.toJSONSchema({ useBsonType: true }) }, indexes: model.schema.indexes().map(([key, options]) => ({ key, ...options })) }));
    const revisions = ['account_balances', 'carryovers', 'categories', 'category_budgets', 'contribution_rules', 'member_incomes', 'recurrences', 'transactions'];
    const expected = structuredClone(snapshot.filter((item) => item.name !== 'events'));
    for (const item of expected) {
        if (revisions.includes(item.name)) item.validator.$jsonSchema.properties.mutationVersion = { bsonType: ['number', 'null'] };
        if (item.name === 'members') {
            item.validator.$jsonSchema.properties.createdByUserId = { bsonType: ['objectId', 'null'] };
            item.indexes.push({ key: { userId: 1 }, name: 'userId_1', background: true });
        }
    }
    assert.deepEqual(JSON.parse(JSON.stringify(current.filter((item) => item.name !== 'events'))), expected);
    // Mongo's frozen migration validators are intentionally stricter than optional Mongoose paths.
    const revisionMigration = migrations.find((entry) => entry.id === '20261107182346881-domain-writer-revisions').migration;
    assert.deepEqual([...revisionMigration.namespaces].sort(), revisions);
    for (const name of revisions) {
        const original = snapshot.find((item) => item.name === name);
        const migrated = structuredClone(original);
        migrated.validator.$jsonSchema.properties.mutationVersion = { bsonType: ['int', 'double'], multipleOf: 1, minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
        assert.deepEqual(revisionMigration.schemaChanges[name], migrated);
        const path = databaseModels.find((model) => model.collection.name === name).schema.path('mutationVersion');
        assert.equal(path.options.default, undefined, 'no backfill/default on historical data');
        assert.equal(path.options.min, 0);
    }
    const memberMigration = migrations.find((entry) => entry.id === '20261107163516618-member-activity').migration;
    const migratedMember = structuredClone(snapshot.find((item) => item.name === 'members'));
    migratedMember.validator.$jsonSchema.properties.createdByUserId = { bsonType: 'objectId' };
    assert.deepEqual(memberMigration.schemaChanges.members, migratedMember);
    const recurrenceMigration = migrations.find((entry) => entry.id === '20261108172127336-recurrence-activity-primitives').migration;
    assert.deepEqual(recurrenceMigration.namespaces, ['events']);
    assert.deepEqual(Object.keys(recurrenceMigration.schemaChanges), ['events']);
    assert.deepEqual(recurrenceMigration.schemaChanges.events.indexes, memberMigration.schemaChanges.events.indexes);
    assert.equal(recurrenceMigration.schemaChanges.events.validator.$and[1].$or[1].$and[0].$jsonSchema.oneOf.length, 44);
    assert.equal(memberMigration.schemaChanges.events.validator.$and[1].$or[1].$and[0].$jsonSchema.oneOf.length, 32, 'historical E05 validator stays frozen');
    const event = current.find((item) => item.name === 'events');
    const legacy = snapshot.find((item) => item.name === 'events');
    assert.deepEqual(event.validator.$jsonSchema.required, legacy.validator.$jsonSchema.required);
    for (const [key, definition] of Object.entries(legacy.validator.$jsonSchema.properties)) assert.deepEqual(event.validator.$jsonSchema.properties[key], definition);
    assert.deepEqual(event.indexes, [...legacy.indexes, { key: { accountId: 1, date: -1, _id: -1 }, name: 'accountId_1_date_-1__id_-1', background: true }]);
    assert.deepEqual(
        Object.keys(event.validator.$jsonSchema.properties)
            .filter((key) => !(key in legacy.validator.$jsonSchema.properties))
            .sort(),
        ['actor', 'batchId', 'commandId', 'correlationId', 'schemaVersion', 'subject', 'trigger']
    );
});
