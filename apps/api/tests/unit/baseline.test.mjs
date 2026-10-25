import assert from 'node:assert/strict';
import { test } from 'node:test';
import snapshot from '../../dist/src/database/baseline/2026-10-v1.json' with { type: 'json' };
import { databaseModels } from '../../dist/src/database/models.js';

test('frozen baseline accurately represents the accepted pre-migration models', () => {
    // When models evolve, replace this comparison with the expected migrated schema test.
    // Never regenerate the historical snapshot to make a future model change pass.
    const current = databaseModels.map((model) => ({ name: model.collection.name, validator: { $jsonSchema: model.schema.toJSONSchema({ useBsonType: true }) }, indexes: model.schema.indexes().map(([key, options]) => ({ key, ...options })) }));
    assert.deepEqual(JSON.parse(JSON.stringify(current)), snapshot);
});
