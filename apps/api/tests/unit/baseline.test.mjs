import assert from 'node:assert/strict';
import { test } from 'node:test';
import snapshot from '../../dist/src/database/baseline/2026-10-v1.json' with { type: 'json' };
import { databaseModels } from '../../dist/src/database/models.js';

test('frozen baseline accurately represents unchanged models; E03 event expansion is separately checked', () => {
    // When models evolve, replace this comparison with the expected migrated schema test.
    // Never regenerate the historical snapshot to make a future model change pass.
    const current = databaseModels.map((model) => ({ name: model.collection.name, validator: { $jsonSchema: model.schema.toJSONSchema({ useBsonType: true }) }, indexes: model.schema.indexes().map(([key, options]) => ({ key, ...options })) }));
    assert.deepEqual(
        JSON.parse(JSON.stringify(current.filter((item) => item.name !== 'events'))),
        snapshot.filter((item) => item.name !== 'events')
    );
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
