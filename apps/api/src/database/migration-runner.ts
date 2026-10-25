import { MigrationDiagnosticError } from './migration-errors.js';
import { createHash, randomUUID } from 'node:crypto';
import type { Db, MongoClient } from 'mongodb';
import { Umzug } from 'umzug';
import { migrations } from './migration-catalog.js';
import { migrationContext } from './migration-types.js';
import type { Direction, MigrationEntry } from './migration-types.js';
import { migrationState, validateCatalog } from './migration-state.js';
import type { Control, SchemaState } from './migration-state.js';
import { migrationStorage } from './migration-storage.js';
import { verifySchema } from './migration-schema.js';
import { StructuralRunner } from './structural-runner.js';
import type { StructuralRun } from './structural-types.js';
import type { MigrationBackup } from './migration-backup.js';

export class MigrationRunner {
    constructor(
        private client: MongoClient,
        private db: Db,
        private uri: string,
        private environment: string,
        private entries: MigrationEntry[] = migrations,
        private options: { backup?: MigrationBackup; productionStructuralApproved?: boolean } = {}
    ) {
        // Parse the authority without URL(), which cannot represent multi-host MongoDB URIs.
        const match = /^mongodb(?:\+srv)?:\/\/([^/]+)\/([^?]+)(?:\?.*)?$/.exec(uri);
        if (!match || decodeURIComponent(match[2]!) !== db.databaseName || ['admin', 'config', 'local'].includes(db.databaseName)) throw new MigrationDiagnosticError('Explicit matching application database required');
        if (!['development', 'test', 'production'].includes(environment)) throw new MigrationDiagnosticError('Explicit migration environment required');
    }

    async plan(direction: Direction = 'up') {
        validateCatalog(this.entries);
        const lock = await this.db.collection<Control>('_tobu_migration_control').findOne({ _id: 'runner' });
        if (lock?.kind === 'structural') {
            const run = await this.db.collection<StructuralRun>('_tobu_migration_runs').findOne({ _id: lock.runId });
            if (!run || run.targetHash !== this.targetHash() || this.entries.find((entry) => entry.id === run.migration)?.checksum !== run.checksum) throw new MigrationDiagnosticError('Invalid structural recovery journal');
            // During restore the schema/history collections can be absent or incomplete.
            const details = { target: this.target(run.before.databaseId), direction, applied: run.before.applied, migrations: [] as { id: string; checksum: string }[], recovery: lock, progress: { stage: run.stage, steps: run.steps } };
            return { ...details, confirmation: this.confirmation(details) };
        }
        const state = await migrationState(this.db, this.entries);
        await verifySchema(this.db, this.entries, state.applied);
        let selected = direction === 'up' ? state.pending : state.applied.slice(-1);
        const structural = selected.findIndex((id) => this.entries.find((entry) => entry.id === id)!.migration.type === 'structural');
        if (structural >= 0) selected = selected.slice(0, structural === 0 ? 1 : structural);
        // Transactional migrations cannot create namespaces. Detect missing ones before locking.
        // An existing lock must remain inspectable for recovery, even if external state changed.
        if (!state.control)
            for (const id of selected) {
                const entry = this.entries.find((entry) => entry.id === id)!;
                if (entry.migration.type !== 'transactional') continue;
                for (const name of entry.migration.namespaces) if (!(await this.db.listCollections({ name }, { nameOnly: true }).hasNext())) throw new MigrationDiagnosticError(`Missing collection ${name}; use a structural migration`);
            }
        const target = this.target(state.state.databaseId);
        const details = {
            target,
            direction,
            applied: state.applied,
            migrations: selected.map((id) => {
                const entry = this.entries.find((entry) => entry.id === id)!;
                return { id, checksum: entry.checksum, type: entry.migration.type, description: entry.migration.description, namespaces: entry.migration.namespaces };
            }),
            recovery: state.control
        };
        // Bind confirmation to URI (including TLS/options), target, history, checksums and lock.
        const confirmation = this.confirmation(details);
        return { ...details, confirmation };
    }

    private target(databaseId?: string) {
        return { environment: this.environment, server: this.uri.split('://')[1]!.split('/')[0]!.split('@').at(-1), database: this.db.databaseName, databaseId: databaseId ?? null };
    }
    private confirmation(details: unknown) {
        return createHash('sha256').update(this.uri).update(JSON.stringify(details)).digest('hex');
    }
    private targetHash() {
        return createHash('sha256').update(this.uri).update(this.environment).digest('hex');
    }
    private structural() {
        if (!this.options.backup) throw new MigrationDiagnosticError('Structural migrations require a configured verified backup backend');
        if (this.environment === 'production' && !this.options.productionStructuralApproved) throw new MigrationDiagnosticError('Production structural migration requires maintenance and protected-backup acknowledgement');
        return new StructuralRunner(this.client, this.db, this.entries, this.options.backup, this.targetHash());
    }

    private async requireTransactions() {
        const hello = await this.db.admin().command({ hello: 1 });
        if (!hello.setName && hello.msg !== 'isdbgrid') throw new MigrationDiagnosticError('Migrations require a replica set or sharded cluster; no standalone fallback');
    }

    async run(direction: Direction, confirmation: string, writersStopped: boolean) {
        const plan = await this.plan(direction);
        if (confirmation !== plan.confirmation || !writersStopped) throw new MigrationDiagnosticError('Exact plan confirmation and stopped writers required');
        if (plan.recovery) throw new MigrationDiagnosticError(`Migration runner is locked; explicit recovery required: ${plan.recovery.runId}`);
        if (!plan.migrations.length) return { applied: [], pending: [] };
        await this.requireTransactions();
        const first = this.entries.find((entry) => entry.id === plan.migrations[0]!.id)!;
        if (first.migration.type === 'structural') return this.structural().begin(first, direction, plan.applied);
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
            if (JSON.stringify(current.applied) !== JSON.stringify(plan.applied) || (current.state.databaseId ?? null) !== plan.target.databaseId) throw new MigrationDiagnosticError('Migration plan became stale');
            for (const item of plan.migrations) {
                const entry = this.entries.find((entry) => entry.id === item.id)!;
                for (const name of entry.migration.namespaces) if (!(await this.db.listCollections({ name }, { nameOnly: true }).hasNext())) throw new MigrationDiagnosticError(`Missing collection ${name}; use a structural migration`);
                const updated = await control.updateOne({ _id: 'runner', runId }, { $set: { migration: item.id, direction, status: 'running' } }, { writeConcern: { w: 'majority' } });
                if (updated.matchedCount !== 1) throw new MigrationDiagnosticError('Migration lock lost');
                const session = this.client.startSession();
                try {
                    await session.withTransaction(
                        async () => {
                            // Writing this document fences recovery and old transactions against each other.
                            const lock = await control.updateOne({ _id: 'runner', runId, migration: item.id }, { $set: { status: 'committed' } }, { session });
                            if (lock.matchedCount !== 1) throw new MigrationDiagnosticError('Migration lock lost');
                            const before = await migrationState(this.db, this.entries, session);
                            const expected = direction === 'up' ? before.pending[0] : before.applied.at(-1);
                            if (expected !== item.id) throw new MigrationDiagnosticError('Migration order changed');
                            const bound = migrationContext(this.db, session, entry.migration.namespaces);
                            try {
                                const umzug = new Umzug({
                                    migrations: this.entries.map((candidate) => ({
                                        name: candidate.id,
                                        up: async () => {
                                            if (candidate.migration.type !== 'transactional') throw new MigrationDiagnosticError('Wrong execution mode');
                                            await candidate.migration.preUp(bound.context);
                                            await candidate.migration.up(bound.context);
                                            await candidate.migration.verifyUp(bound.context);
                                        },
                                        down: async () => {
                                            if (candidate.migration.type !== 'transactional') throw new MigrationDiagnosticError('Wrong execution mode');
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
                            if (result.matchedCount !== 1) throw new MigrationDiagnosticError('Schema marker lost');
                        },
                        { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', timeoutMS: 60000, maxCommitTimeMS: 15000 }
                    );
                } finally {
                    await session.endSession();
                }
                completed.push(item.id);
            }
            const removed = await control.deleteOne({ _id: 'runner', runId, status: 'committed' }, { writeConcern: { w: 'majority' } });
            if (removed.deletedCount !== 1) throw new MigrationDiagnosticError('Migration lock changed before release');
            return { applied: completed, pending: (await migrationState(this.db, this.entries)).pending };
        } catch (error) {
            // Includes unknown commit results: keep maintenance in place. Never run down on speculation.
            throw new MigrationDiagnosticError(`Migration stopped; recovery required for run ${runId}`, { cause: error });
        }
    }

    async recover(confirmation: string, stoppedRun: string, writersStopped: boolean, action?: 'resume' | 'restore') {
        const plan = await this.plan();
        if (!plan.recovery || plan.recovery.runId !== stoppedRun || plan.confirmation !== confirmation || !writersStopped) throw new MigrationDiagnosticError('Fresh recovery confirmation, stopped runner ID and stopped writers required');
        await this.requireTransactions();
        if (plan.recovery.kind === 'structural') {
            if (!action) throw new MigrationDiagnosticError('Choose resume or restore explicitly for structural recovery');
            return this.structural().recover(plan.recovery, action);
        }
        const session = this.client.startSession();
        try {
            return await session.withTransaction(
                async () => {
                    const control = this.db.collection<Control>('_tobu_migration_control');
                    const removed = await control.deleteOne({ _id: 'runner', runId: stoppedRun }, { session });
                    if (removed.deletedCount !== 1) throw new MigrationDiagnosticError('Recovery lock changed');
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
