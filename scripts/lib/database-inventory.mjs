import { createHash } from 'node:crypto';
import { apiRequire } from './config.mjs';

// Verification only, not a home-grown backup format: the backup itself is BSON via Database Tools.
export async function databaseInventory(db) {
    const { BSON } = apiRequire('mongodb');
    const collections = await db.listCollections({}, { nameOnly: false }).toArray();
    const result = [];
    for (const info of collections.sort((a, b) => a.name.localeCompare(b.name))) {
        if (info.name.startsWith('system.') || info.type !== 'collection' || info.options?.timeseries || info.options?.encryptedFields) {
            throw new Error(`Unsupported collection for verified local conversion: ${info.name}`);
        }
        const collection = db.collection(info.name);
        // Only the pinned local Community image is supported here, never Atlas.
        const hash = createHash('sha256');
        let count = 0;
        for await (const document of collection.find({}, { sort: { _id: 1 }, promoteValues: false, promoteBuffers: false, bsonRegExp: true })) {
            hash.update(BSON.serialize(document));
            count++;
        }
        const indexes = (await collection.listIndexes().toArray())
            .map((index) => {
                delete index.ns;
                delete index.v;
                return index;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
        result.push({ name: info.name, options: BSON.EJSON.stringify(info.options, { relaxed: false }), indexes: BSON.EJSON.stringify(indexes, { relaxed: false }), count, digest: hash.digest('hex') });
    }
    return result;
}
