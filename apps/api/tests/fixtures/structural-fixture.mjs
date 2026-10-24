import assert from 'node:assert/strict';
import { BSON } from 'mongodb';
import { inventory, OPERATIONAL } from '../../dist/src/database/migration-backup.js';

export function structuralEntry(options = {}) {
    const schema = { name: 'renamed_data', validator: {}, indexes: [{ key: { value: 1 }, name: 'value_1', unique: true }] };
    const rename = (from, to) => ({
        id: 'rename',
        async inspect(ctx) {
            const a = await ctx.info(from),
                b = await ctx.info(to);
            return a && !b ? 'before' : !a && b ? 'after' : 'ambiguous';
        },
        async apply(ctx) {
            await ctx.rename(from, to);
            await options.afterRename?.();
        },
        async verify(ctx) {
            assert.ok(await ctx.info(to));
            assert.equal(await ctx.info(from), null);
        }
    });
    const index = {
        id: 'index',
        async inspect(ctx) {
            return (await ctx.indexes('renamed_data')).some((item) => item.name === 'value_1') ? 'after' : 'before';
        },
        async apply(ctx) {
            await ctx.createIndexes('renamed_data', schema.indexes);
        },
        async verify(ctx) {
            assert.ok((await ctx.indexes('renamed_data')).some((item) => item.name === 'value_1'));
        }
    };
    return {
        id: '20261024000000000-structural-test',
        checksum: 'c'.repeat(64),
        migration: {
            type: 'structural',
            predecessor: '2026-10-v1',
            description: 'Rename and index fixture',
            namespaces: ['original_data', 'renamed_data'],
            schemaChanges: { original_data: null, renamed_data: schema },
            async preUp(ctx) {
                assert.ok(await ctx.info('original_data'));
            },
            async preDown(ctx) {
                assert.ok(await ctx.info('renamed_data'));
            },
            up: [rename('original_data', 'renamed_data'), index],
            down: [
                {
                    id: 'remove-index',
                    async inspect(ctx) {
                        return !(await ctx.info('renamed_data')) || !(await ctx.indexes('renamed_data')).some((item) => item.name === 'value_1') ? 'after' : 'before';
                    },
                    async apply(ctx) {
                        await ctx.dropIndex('renamed_data', 'value_1');
                    },
                    async verify(ctx) {
                        if (await ctx.info('renamed_data')) assert.ok(!(await ctx.indexes('renamed_data')).some((item) => item.name === 'value_1'));
                    }
                },
                rename('renamed_data', 'original_data')
            ],
            async verifyUp(ctx) {
                assert.equal(await ctx.count('renamed_data', {}), 2);
            },
            async verifyDown(ctx) {
                assert.equal(await ctx.count('original_data', {}), 2);
                assert.equal(await ctx.info('renamed_data'), null);
            }
        }
    };
}

// TEST DOUBLE ONLY: tests runner state transitions against real MongoDB.
// Production archive/Tools fidelity is tested separately in tests-docker.
export class MemoryBackup {
    constructor(db) {
        this.db = db;
        this.saved = new Map();
    }
    async prepare(runId, targetHash) {
        const collections = [];
        for (const info of await this.db.listCollections().toArray()) {
            if (OPERATIONAL.includes(info.name)) continue;
            collections.push({ info, indexes: await this.db.collection(info.name).listIndexes().toArray(), documents: (await this.db.collection(info.name).find({}, { promoteValues: false }).toArray()).map((doc) => BSON.serialize(doc)) });
        }
        this.saved.set(runId, { collections, manifest: { runId, targetHash, verified: true, inventory: await inventory(this.db), digest: 'test-double', serverVersion: 'test-double' } });
    }
    async inspect(runId, targetHash) {
        const item = this.saved.get(runId);
        assert.equal(item?.manifest.targetHash, targetHash);
        return item.manifest;
    }
    async restore(runId, targetHash) {
        await this.inspect(runId, targetHash);
        for (const info of await this.db.listCollections().toArray()) if (!OPERATIONAL.includes(info.name)) await this.db.collection(info.name).drop();
        if (this.interruptRestore) {
            this.interruptRestore = false;
            throw new Error('test restore interrupted');
        }
        for (const { info, indexes, documents } of this.saved.get(runId).collections) {
            await this.db.createCollection(info.name, info.options);
            if (documents.length) await this.db.collection(info.name).insertMany(documents.map((doc) => BSON.deserialize(doc, { promoteValues: false })));
            for (const definition of indexes) {
                const index = { ...definition };
                delete index.v;
                delete index.ns;
                if (index.name !== '_id_') await this.db.collection(info.name).createIndexes([index]);
            }
        }
    }
}
