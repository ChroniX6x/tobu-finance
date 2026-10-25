import { MigrationDiagnosticError } from './migration-errors.js';
import { randomUUID } from 'node:crypto';
import type { Db, MongoClient } from 'mongodb';
import type { MigrationEntry, Direction } from './migration-types.js';
import type { StructuralMigration, StructuralRun, StructuralContext } from './structural-types.js';
import type { MigrationBackup } from './migration-backup.js';
import { migrationState } from './migration-state.js';
import type { Control, SchemaState } from './migration-state.js';
import { migrationStorage } from './migration-storage.js';
import { structuralContext } from './structural-context.js';
import { verifySchema } from './migration-schema.js';

export class StructuralRunner {
    constructor(
        private client: MongoClient,
        private db: Db,
        private entries: MigrationEntry[],
        private backup: MigrationBackup,
        private targetHash: string
    ) {}
    private controls() {
        return this.db.collection<Control>('_tobu_migration_control');
    }
    private runs() {
        return this.db.collection<StructuralRun>('_tobu_migration_runs');
    }
    private async owner(runId: string, owner: string) {
        if (!(await this.controls().findOne({ _id: 'runner', runId, owner, kind: 'structural' }))) throw new MigrationDiagnosticError('Structural runner ownership lost');
    }
    private async idle(runId: string) {
        const operations = await this.client
            .db('admin')
            .aggregate([{ $currentOp: { allUsers: true, idleConnections: false } }, { $match: { $or: [{ 'command.comment': runId }, { 'clientMetadata.application.name': `tobu-migration-${runId}` }] } }])
            .toArray();
        if (operations.length) throw new MigrationDiagnosticError('Old server operations are still running; keep maintenance and wait for them to end');
    }
    private async context<T>(run: StructuralRun, migration: StructuralMigration, owner: string, readOnly: boolean, action: (ctx: StructuralContext) => Promise<T>) {
        const bound = structuralContext(this.db, migration.namespaces, run._id, () => this.owner(run._id, owner), readOnly);
        try {
            return await action(bound.context);
        } finally {
            await bound.close();
        }
    }
    async begin(entry: MigrationEntry, direction: Direction, expectedApplied: string[]) {
        if (entry.migration.type !== 'structural') throw new MigrationDiagnosticError('Structural definition required');
        const state = await migrationState(this.db, this.entries);
        if (state.control || JSON.stringify(state.applied) !== JSON.stringify(expectedApplied)) throw new MigrationDiagnosticError('Structural plan became stale');
        const runId = randomUUID();
        // Verify privileges to inspect lingering operations before any migration activity.
        await this.idle(runId);
        for (const name of ['_tobu_migration_control', '_tobu_migration_runs', '_tobu_migrations']) {
            try {
                await this.db.createCollection(name);
            } catch (error) {
                if ((error as { code?: number }).code !== 48) throw error;
            }
        }
        const run: StructuralRun = { _id: runId, migration: entry.id, checksum: entry.checksum, direction, targetHash: this.targetHash, before: state.state, history: state.history, stage: 'preparing', steps: {} };
        const session = this.client.startSession();
        try {
            await session.withTransaction(
                async () => {
                    await this.controls().insertOne({ _id: 'runner', runId, owner: runId, kind: 'structural', migration: entry.id, direction, status: 'running', startedAt: new Date() }, { session });
                    const current = await migrationState(this.db, this.entries, session);
                    if (JSON.stringify(current.applied) !== JSON.stringify(expectedApplied)) throw new MigrationDiagnosticError('Structural predecessor changed');
                    await this.runs().insertOne(run, { session });
                },
                { writeConcern: { w: 'majority' }, readConcern: { level: 'snapshot' }, timeoutMS: 60000 }
            );
        } finally {
            await session.endSession();
        }
        await this.advance(run, entry.migration, runId);
        return { applied: [entry.id], pending: (await migrationState(this.db, this.entries)).pending };
    }
    private async stage(run: StructuralRun, owner: string, stage: StructuralRun['stage']) {
        await this.owner(run._id, owner);
        await this.runs().updateOne({ _id: run._id }, { $set: { stage } }, { writeConcern: { w: 'majority' } });
        run.stage = stage;
    }
    private async release(run: StructuralRun, owner: string, outcome: 'succeeded' | 'restored') {
        const session = this.client.startSession();
        try {
            await session.withTransaction(
                async () => {
                    const deleted = await this.controls().deleteOne({ _id: 'runner', runId: run._id, owner }, { session });
                    if (deleted.deletedCount !== 1) throw new MigrationDiagnosticError('Structural lock changed');
                    await this.runs().updateOne({ _id: run._id }, { $set: { stage: outcome } }, { session });
                },
                { writeConcern: { w: 'majority' }, readConcern: { level: 'snapshot' }, timeoutMS: 60000 }
            );
        } finally {
            await session.endSession();
        }
    }
    private async advance(run: StructuralRun, migration: StructuralMigration, owner: string) {
        if (run.stage === 'restoring' || run.stage === 'restored') throw new MigrationDiagnosticError('Interrupted restore must finish; migration resume refused');
        const applied = run.direction === 'up' ? [...run.before.applied, run.migration] : run.before.applied.slice(0, -1);
        if (run.stage === 'succeeded') {
            if (JSON.stringify((await migrationState(this.db, this.entries)).applied) !== JSON.stringify(applied)) throw new MigrationDiagnosticError('Committed structural history differs');
            await verifySchema(this.db, this.entries, applied);
            await this.context(run, migration, owner, true, (context) => migration[run.direction === 'up' ? 'verifyUp' : 'verifyDown'](context));
            await this.release(run, owner, 'succeeded');
            return;
        }
        if (run.stage === 'preparing') {
            await verifySchema(this.db, this.entries, run.before.applied);
            await this.context(run, migration, owner, true, (context) => migration[run.direction === 'up' ? 'preUp' : 'preDown'](context));
            await this.backup.prepare(run._id, this.targetHash);
            await this.stage(run, owner, 'backup-verified');
        }
        await this.backup.inspect(run._id, this.targetHash);
        await this.stage(run, owner, 'applying');
        for (const step of migration[run.direction]) {
            const status = await this.context(run, migration, owner, true, (context) => step.inspect(context));
            if (status === 'ambiguous' || (run.steps[step.id] === 'done' && status !== 'after')) throw new MigrationDiagnosticError('Ambiguous structural step; verified restore required');
            if (status === 'before') {
                await this.owner(run._id, owner);
                await this.runs().updateOne({ _id: run._id }, { $set: { [`steps.${step.id}`]: 'started' } }, { writeConcern: { w: 'majority' } });
                await this.context(run, migration, owner, false, (context) => step.apply(context));
            } else if (status !== 'after') throw new MigrationDiagnosticError('Invalid inspection result');
            await this.context(run, migration, owner, true, (context) => step.verify(context));
            if ((await this.context(run, migration, owner, true, (context) => step.inspect(context))) !== 'after') throw new MigrationDiagnosticError('Step did not reach its declared target');
            await this.runs().updateOne({ _id: run._id }, { $set: { [`steps.${step.id}`]: 'done' } }, { writeConcern: { w: 'majority' } });
            run.steps[step.id] = 'done';
        }
        await this.stage(run, owner, 'verifying');
        await verifySchema(this.db, this.entries, applied);
        await this.context(run, migration, owner, true, (context) => migration[run.direction === 'up' ? 'verifyUp' : 'verifyDown'](context));
        const session = this.client.startSession();
        const databaseId = run.before.databaseId ?? randomUUID();
        try {
            await session.withTransaction(
                async () => {
                    const lock = await this.controls().updateOne({ _id: 'runner', runId: run._id, owner }, { $set: { status: 'committed' } }, { session });
                    if (lock.matchedCount !== 1) throw new MigrationDiagnosticError('Structural lock changed');
                    const state = await migrationState(this.db, this.entries, session);
                    if (JSON.stringify(state.applied) !== JSON.stringify(run.before.applied)) throw new MigrationDiagnosticError('Structural history changed');
                    const storage = migrationStorage(this.db, session, this.entries, run._id);
                    await storage[run.direction === 'up' ? 'logMigration' : 'unlogMigration']({ name: run.migration, context: undefined });
                    await this.db.collection<SchemaState>('_tobu_schema').updateOne({ _id: 'baseline' }, { $set: { applied, databaseId } }, { session });
                    await this.runs().updateOne({ _id: run._id }, { $set: { stage: 'succeeded' } }, { session });
                },
                { writeConcern: { w: 'majority' }, readConcern: { level: 'snapshot' }, timeoutMS: 60000 }
            );
        } finally {
            await session.endSession();
        }
        await this.release(run, owner, 'succeeded');
    }
    async recover(control: Control, action: 'resume' | 'restore') {
        const run = await this.runs().findOne({ _id: control.runId });
        const entry = this.entries.find((entry) => entry.id === run?.migration);
        if (!run || !entry || entry.checksum !== run.checksum || entry.migration.type !== 'structural' || run.targetHash !== this.targetHash) throw new MigrationDiagnosticError('Structural recovery identity mismatch');
        for (const history of run.history) if (this.entries.find((entry) => entry.id === history._id)?.checksum !== history.checksum) throw new MigrationDiagnosticError('Historical migration changed');
        await this.idle(run._id);
        if (!control.owner) throw new MigrationDiagnosticError('Structural owner missing');
        const owner = randomUUID();
        const claimed = await this.controls().updateOne({ _id: 'runner', runId: run._id, owner: control.owner }, { $set: { owner } }, { writeConcern: { w: 'majority' } });
        if (claimed.matchedCount !== 1) throw new MigrationDiagnosticError('Another recovery owns the run');
        if (action === 'resume') {
            await this.advance(run, entry.migration, owner);
            return { outcome: 'completed' };
        }
        if (run.stage === 'succeeded') throw new MigrationDiagnosticError('Committed migration cannot be restored from a historical backup; use a new down plan');
        if (run.stage !== 'preparing') {
            await this.backup.inspect(run._id, this.targetHash);
            await this.stage(run, owner, 'restoring');
            await this.backup.restore(run._id, this.targetHash, entry.migration.namespaces);
        }
        // preparing never executed a structural write; cancellation needs no destructive restore.
        const restored = await migrationState(this.db, this.entries);
        if (JSON.stringify(restored.applied) !== JSON.stringify(run.before.applied)) throw new MigrationDiagnosticError('Restore history differs');
        await verifySchema(this.db, this.entries, run.before.applied);
        if (run.stage !== 'preparing')
            await this.context(run, entry.migration, owner, true, (context) =>
                entry.migration.type === 'structural' ? entry.migration[run.direction === 'up' ? 'preUp' : 'preDown'](context) : Promise.reject(new MigrationDiagnosticError('Wrong recovery type'))
            );
        await this.release(run, owner, 'restored');
        return { outcome: 'restored' };
    }
}
