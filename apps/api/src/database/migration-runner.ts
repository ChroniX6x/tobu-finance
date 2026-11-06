import { MigrationDiagnosticError, withMigrationPhase, protectMigrationFailure, isProtectedMigrationFailure } from './migration-errors.js';
import { createHash, randomUUID } from 'node:crypto';
import { MongoClient, type Db } from 'mongodb';
import { Umzug, MigrationError } from 'umzug';
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
import { migrationTarget, migrationTargetHash, migrationConnectionPolicy, migrationEndpoint, requireCurrentIdentity } from './migration-target.js';
import type { MigrationTarget } from './migration-target.js';

export class MigrationRunner {
    constructor(
        private client: MongoClient,
        private db: Db,
        uri: string,
        private environment: string,
        private entries: MigrationEntry[] = migrations,
        private options: { backup?: MigrationBackup; productionStructuralApproved?: boolean } = {}
    ) {
        // Parse the authority without URL(), which cannot represent multi-host MongoDB URIs.
        const match = /^mongodb(?:\+srv)?:\/\/([^/]+)\/([^?]+)(?:\?.*)?$/.exec(uri);
        if (!match || decodeURIComponent(match[2]!) !== db.databaseName || ['admin', 'config', 'local'].includes(db.databaseName)) throw new MigrationDiagnosticError('Explicit matching application database required');
        if (migrationEndpoint(new MongoClient(uri)) !== migrationEndpoint(client)) throw new MigrationDiagnosticError('Migration URI does not match the connected client endpoints');
        if (!['development', 'test', 'production'].includes(environment)) throw new MigrationDiagnosticError('Explicit migration environment required');
    }

    async plan(direction: Direction = 'up') {
        validateCatalog(this.entries);
        const lock = await this.db.collection<Control>('_tobu_migration_control').findOne({ _id: 'runner' });
        if (lock) requireCurrentIdentity(lock.identityVersion);
        if (lock?.kind === 'structural') {
            const run = await this.db.collection<StructuralRun>('_tobu_migration_runs').findOne({ _id: lock.runId });
            if (!run) throw new MigrationDiagnosticError('Invalid structural recovery journal');
            requireCurrentIdentity(run.identityVersion);
            const target = await migrationTarget(this.client, this.db, this.environment, run.before.databaseId);
            const marker = await this.db.collection<SchemaState>('_tobu_schema').findOne({ _id: 'baseline' });
            if ((!marker && run.stage !== 'restoring') || (marker && marker.databaseId !== run.before.databaseId)) throw new MigrationDiagnosticError('Recovery database identity differs from journal');
            const hash = migrationTargetHash(target);
            if (run.targetHash !== hash || lock.targetHash !== hash || this.entries.find((entry) => entry.id === run.migration)?.checksum !== run.checksum) throw new MigrationDiagnosticError('Invalid structural recovery journal');
            // During restore the schema/history collections can be absent or incomplete.
            const details = { target, direction, applied: run.before.applied, migrations: [] as { id: string; checksum: string }[], recovery: lock, progress: { stage: run.stage, steps: run.steps } };
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
        const target = await migrationTarget(this.client, this.db, this.environment, state.state.databaseId);
        if (state.control && state.control.targetHash !== migrationTargetHash(target)) throw new MigrationDiagnosticError('Recovery target identity differs from lock');
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
        // Bind effective non-secret connection policy, deployment, history, checksums and lock.
        const confirmation = this.confirmation(details);
        return { ...details, confirmation };
    }

    private confirmation(details: unknown) {
        return createHash('sha256')
            .update(JSON.stringify({ policy: migrationConnectionPolicy(this.client), details }))
            .digest('hex');
    }
    private structural(target: MigrationTarget) {
        if (!this.options.backup) throw new MigrationDiagnosticError('Structural migrations require a configured verified backup backend');
        if (this.environment === 'production' && !this.options.productionStructuralApproved) throw new MigrationDiagnosticError('Production structural migration requires maintenance and protected-backup acknowledgement');
        return new StructuralRunner(this.client, this.db, this.entries, this.options.backup, target);
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
        if (first.migration.type === 'structural') return this.structural(plan.target).begin(first, direction, plan.applied);
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
        const databaseId = plan.target.databaseId ?? randomUUID();
        const lock: Control = { _id: 'runner', runId, migration: plan.migrations[0]!.id, direction, status: 'running', startedAt: new Date(), identityVersion: 2, targetHash: migrationTargetHash({ ...plan.target, databaseId }) };
        if (plan.target.databaseId === null) {
            // A historical baseline gets its identity atomically with the confirmed lock, before backup/writes.
            const session = this.client.startSession();
            try {
                await session.withTransaction(
                    async () => {
                        const assigned = await this.db.collection<SchemaState>('_tobu_schema').updateOne({ _id: 'baseline', databaseId: { $exists: false } }, { $set: { databaseId } }, { session });
                        if (assigned.matchedCount !== 1) throw new MigrationDiagnosticError('Database identity changed; replan');
                        await control.insertOne(lock, { session });
                    },
                    { writeConcern: { w: 'majority' }, readConcern: { level: 'snapshot' }, timeoutMS: 60000 }
                );
            } finally {
                await session.endSession();
            }
        } else await control.insertOne(lock, { writeConcern: { w: 'majority' } });
        const completed: string[] = [];
        try {
            // Recheck after acquiring the exclusive lock to reject a stale plan.
            const current = await migrationState(this.db, this.entries);
            if (JSON.stringify(current.applied) !== JSON.stringify(plan.applied) || current.state.databaseId !== databaseId) throw new MigrationDiagnosticError('Migration plan became stale');
            for (const item of plan.migrations) {
                const entry = this.entries.find((entry) => entry.id === item.id)!;
                for (const name of entry.migration.namespaces) if (!(await this.db.listCollections({ name }, { nameOnly: true }).hasNext())) throw new MigrationDiagnosticError(`Missing collection ${name}; use a structural migration`);
                const updated = await control.updateOne({ _id: 'runner', runId }, { $set: { migration: item.id, direction, status: 'running' } }, { writeConcern: { w: 'majority' } });
                if (updated.matchedCount !== 1) throw new MigrationDiagnosticError('Migration lock lost');
                const session = this.client.startSession();
                try {
                    await withMigrationPhase('transaction', () =>
                        session.withTransaction(
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
                                            up: () =>
                                                protectMigrationFailure(async () => {
                                                    const definition = candidate.migration;
                                                    if (definition.type !== 'transactional') throw new MigrationDiagnosticError('Wrong execution mode');
                                                    await withMigrationPhase('preUp', () => definition.preUp(bound.context));
                                                    await withMigrationPhase('up', () => definition.up(bound.context));
                                                    await withMigrationPhase('verifyUp', () => definition.verifyUp(bound.context));
                                                }),
                                            down: () =>
                                                protectMigrationFailure(async () => {
                                                    const definition = candidate.migration;
                                                    if (definition.type !== 'transactional') throw new MigrationDiagnosticError('Wrong execution mode');
                                                    await withMigrationPhase('preDown', () => definition.preDown(bound.context));
                                                    await withMigrationPhase('down', () => definition.down(bound.context));
                                                    await withMigrationPhase('verifyDown', () => definition.verifyDown(bound.context));
                                                })
                                        })),
                                        storage: migrationStorage(this.db, session, this.entries, runId),
                                        logger: undefined
                                    });
                                    try {
                                        if (direction === 'up') await umzug.up({ migrations: [item.id] });
                                        else await umzug.down({ migrations: [item.id] });
                                    } catch (error) {
                                        // Preserve driver's transient-error labels hidden by Umzug's wrapper.
                                        if (error instanceof MigrationError) {
                                            const cause: unknown = Object.getOwnPropertyDescriptor(error, 'jse_cause')?.value;
                                            if (isProtectedMigrationFailure(cause)) throw cause;
                                        }
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
                        )
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
            return this.structural(plan.target).recover(plan.recovery, action);
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
