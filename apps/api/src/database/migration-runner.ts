import { createHash, randomUUID } from 'node:crypto';
import type { Db, MongoClient } from 'mongodb';
import { Umzug } from 'umzug';
import { migrations } from './migration-catalog.js';
import { migrationContext } from './migration-types.js';
import type { Direction, MigrationEntry } from './migration-types.js';
import { migrationState } from './migration-state.js';
import type { Control, SchemaState } from './migration-state.js';
import { migrationStorage } from './migration-storage.js';
import { verifyBaselineSchema } from './baseline.js';

export class MigrationRunner {
    constructor(
        private client: MongoClient,
        private db: Db,
        private uri: string,
        private environment: string,
        private entries: MigrationEntry[] = migrations
    ) {
        // Parse the authority without URL(), which cannot represent multi-host MongoDB URIs.
        const match = /^mongodb(?:\+srv)?:\/\/([^/]+)\/([^?]+)(?:\?.*)?$/.exec(uri);
        if (!match || decodeURIComponent(match[2]!) !== db.databaseName || ['admin', 'config', 'local'].includes(db.databaseName)) throw new Error('Explicit matching application database required');
        if (!['development', 'test', 'production'].includes(environment)) throw new Error('Explicit migration environment required');
    }

    async plan(direction: Direction = 'up') {
        const state = await migrationState(this.db, this.entries);
        await verifyBaselineSchema(this.db);
        const selected = direction === 'up' ? state.pending : state.applied.slice(-1);
        const target = { environment: this.environment, server: this.uri.split('://')[1]!.split('/')[0]!.split('@').at(-1), database: this.db.databaseName, databaseId: state.state.databaseId ?? null };
        const details = { target, direction, applied: state.applied, migrations: selected.map((id) => ({ id, checksum: this.entries.find((entry) => entry.id === id)!.checksum })), recovery: state.control };
        // Bind confirmation to URI (including TLS/options), target, history, checksums and lock.
        const confirmation = createHash('sha256').update(this.uri).update(JSON.stringify(details)).digest('hex');
        return { ...details, confirmation };
    }

    private async requireTransactions() {
        const hello = await this.db.admin().command({ hello: 1 });
        if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Migrations require a replica set or sharded cluster; no standalone fallback');
    }

    async run(direction: Direction, confirmation: string, writersStopped: boolean) {
        const plan = await this.plan(direction);
        if (confirmation !== plan.confirmation || !writersStopped) throw new Error('Exact plan confirmation and stopped writers required');
        if (plan.recovery) throw new Error(`Migration runner is locked; explicit recovery required: ${plan.recovery.runId}`);
        if (!plan.migrations.length) return { applied: [], pending: [] };
        await this.requireTransactions();
        // Explicit metadata creation outside the data transaction, after validation/confirmation.
        for (const name of ['_tobu_migrations', '_tobu_migration_control']) {
            try {
                await this.db.createCollection(name);
            } catch (error) {
                if ((error as { code?: number }).code !== 48) throw error;
            }
        }
        const runId = randomUUID();
        const control = this.db.collection<Control>('_tobu_migration_control');
        await control.insertOne({ _id: 'runner', runId, migration: plan.migrations[0]!.id, direction, status: 'running', startedAt: new Date() }, { writeConcern: { w: 'majority' } });
        const databaseId = plan.target.databaseId ?? randomUUID();
        const completed: string[] = [];
        try {
            // Recheck after acquiring the exclusive lock to reject a stale plan.
            const current = await migrationState(this.db, this.entries);
            if (JSON.stringify(current.applied) !== JSON.stringify(plan.applied) || (current.state.databaseId ?? null) !== plan.target.databaseId) throw new Error('Migration plan became stale');
            for (const item of plan.migrations) {
                const entry = this.entries.find((entry) => entry.id === item.id)!;
                for (const name of entry.migration.namespaces) if (!(await this.db.listCollections({ name }, { nameOnly: true }).hasNext())) throw new Error(`Missing collection ${name}; use a structural migration`);
                const updated = await control.updateOne({ _id: 'runner', runId }, { $set: { migration: item.id, direction, status: 'running' } }, { writeConcern: { w: 'majority' } });
                if (updated.matchedCount !== 1) throw new Error('Migration lock lost');
                const session = this.client.startSession();
                try {
                    await session.withTransaction(
                        async () => {
                            // Writing this document fences recovery and old transactions against each other.
                            const lock = await control.updateOne({ _id: 'runner', runId, migration: item.id }, { $set: { status: 'committed' } }, { session });
                            if (lock.matchedCount !== 1) throw new Error('Migration lock lost');
                            const before = await migrationState(this.db, this.entries, session);
                            const expected = direction === 'up' ? before.pending[0] : before.applied.at(-1);
                            if (expected !== item.id) throw new Error('Migration order changed');
                            const bound = migrationContext(this.db, session, entry.migration.namespaces);
                            try {
                                const umzug = new Umzug({
                                    migrations: this.entries.map((candidate) => ({
                                        name: candidate.id,
                                        up: async () => {
                                            await candidate.migration.preUp(bound.context);
                                            await candidate.migration.up(bound.context);
                                            await candidate.migration.verifyUp(bound.context);
                                        },
                                        down: async () => {
                                            await candidate.migration.preDown(bound.context);
                                            await candidate.migration.down(bound.context);
                                            await candidate.migration.verifyDown(bound.context);
                                        }
                                    })),
                                    storage: migrationStorage(this.db, session, this.entries, runId),
                                    logger: undefined
                                });
                                try {
                                    if (direction === 'up') await umzug.up({ migrations: [item.id] });
                                    else await umzug.down({ migrations: [item.id] });
                                } catch (error) {
                                    // Preserve driver's transient-error labels hidden by Umzug's wrapper.
                                    if (error instanceof Error && error.name === 'MigrationError' && error.cause instanceof Error) throw error.cause;
                                    throw error;
                                }
                            } finally {
                                await bound.close();
                            }
                            const applied = direction === 'up' ? [...before.applied, item.id] : before.applied.slice(0, -1);
                            const result = await this.db.collection<SchemaState>('_tobu_schema').updateOne({ _id: 'baseline' }, { $set: { applied, databaseId } }, { session });
                            if (result.matchedCount !== 1) throw new Error('Schema marker lost');
                        },
                        { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', timeoutMS: 60000, maxCommitTimeMS: 15000 }
                    );
                } finally {
                    await session.endSession();
                }
                completed.push(item.id);
            }
            const removed = await control.deleteOne({ _id: 'runner', runId, status: 'committed' }, { writeConcern: { w: 'majority' } });
            if (removed.deletedCount !== 1) throw new Error('Migration lock changed before release');
            return { applied: completed, pending: (await migrationState(this.db, this.entries)).pending };
        } catch (error) {
            // Includes unknown commit results: keep maintenance in place. Never run down on speculation.
            throw new Error(`Migration stopped; recovery required for run ${runId}`, { cause: error });
        }
    }

    async recover(confirmation: string, stoppedRun: string, writersStopped: boolean) {
        const plan = await this.plan();
        if (!plan.recovery || plan.recovery.runId !== stoppedRun || plan.confirmation !== confirmation || !writersStopped) throw new Error('Fresh recovery confirmation, stopped runner ID and stopped writers required');
        await this.requireTransactions();
        const session = this.client.startSession();
        try {
            return await session.withTransaction(
                async () => {
                    const control = this.db.collection<Control>('_tobu_migration_control');
                    const removed = await control.deleteOne({ _id: 'runner', runId: stoppedRun }, { session });
                    if (removed.deletedCount !== 1) throw new Error('Recovery lock changed');
                    // A conflicting old transaction cannot commit once this fence commits.
                    const current = await migrationState(this.db, this.entries, session);
                    const committed = current.history.some((record) => record._id === plan.recovery!.migration && record.runId === stoppedRun && record.applied === (plan.recovery!.direction === 'up'));
                    return { runId: stoppedRun, outcome: committed ? 'committed' : 'not-committed', applied: current.applied };
                },
                { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', timeoutMS: 120000, maxCommitTimeMS: 15000 }
            );
        } finally {
            await session.endSession();
        }
    }
}
