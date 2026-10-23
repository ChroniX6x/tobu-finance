import { setTimeout as delay } from 'node:timers/promises';
import { apiRequire } from './config.mjs';

export const LOCAL_REPLICA_SET = 'tobu-local';

// This helper is only for containers owned by the local orchestrator, never external URIs.
export async function initializeLocalReplicaSet(uri, member, { timeoutMS = 60000 } = {}) {
    const { MongoClient } = apiRequire('mongodb');
    const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 2000 });
    const deadline = Date.now() + timeoutMS;
    let lastError;
    try {
        while (Date.now() < deadline) {
            try {
                await client.connect();
                const admin = client.db('admin');
                let config;
                try {
                    config = (await admin.command({ replSetGetConfig: 1 })).config;
                } catch (error) {
                    if (error.code !== 94) throw error; // NotYetInitialized only.
                    try {
                        await admin.command({ replSetInitiate: { _id: LOCAL_REPLICA_SET, members: [{ _id: 0, host: member }] } });
                    } catch (initError) {
                        if (initError.code !== 23) throw initError; // A concurrent initializer won; inspect it next.
                    }
                    await delay(200);
                    continue;
                }
                if (config._id !== LOCAL_REPLICA_SET || config.members.length !== 1 || config.members[0].host !== member) {
                    throw new Error('Refusing to reconfigure an unexpected local replica set', { cause: 'unexpected-topology' });
                }
                if ((await admin.command({ hello: 1 })).isWritablePrimary) return;
            } catch (error) {
                if (error.cause === 'unexpected-topology' || [13, 76].includes(error.code)) throw error;
                lastError = error;
            }
            await delay(300);
        }
        throw new Error('Local MongoDB replica set did not become writable', { cause: lastError });
    } finally {
        await client.close();
    }
}
