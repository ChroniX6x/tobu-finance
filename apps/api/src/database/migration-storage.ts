import type { ClientSession, Db } from 'mongodb';
import type { UmzugStorage } from 'umzug';
import type { MigrationEntry } from './migration-types.js';
import type { History } from './migration-state.js';

// Called by Umzug INSIDE the same transaction as up/down, never after commit.
export function migrationStorage(db: Db, session: ClientSession, entries: MigrationEntry[], runId: string): UmzugStorage {
    const history = db.collection<History>('_tobu_migrations');
    async function record(name: string, applied: boolean) {
        const entry = entries.find((entry) => entry.id === name);
        if (!entry) throw new Error('Unknown migration');
        await history.updateOne({ _id: name }, { $set: { checksum: entry.checksum, applied, runId } }, { upsert: true, session });
    }
    return {
        executed: async () => (await history.find({ applied: true }, { session }).toArray()).map((record) => record._id),
        logMigration: async ({ name }) => record(name, true),
        // Retain checksums even after down: edited historical files must still be rejected.
        unlogMigration: async ({ name }) => record(name, false)
    };
}
