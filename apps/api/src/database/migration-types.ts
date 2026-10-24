import type { ClientSession, Db, Document, Filter, UpdateFilter } from 'mongodb';
import type { StructuralMigration } from './structural-types.js';

export type Direction = 'up' | 'down';
export type MigrationContext = ReturnType<typeof migrationContext>['context'];
export interface TransactionalMigration {
    type: 'transactional';
    predecessor: string;
    description: string;
    namespaces: string[];
    preUp(context: MigrationContext): Promise<void>;
    up(context: MigrationContext): Promise<void>;
    verifyUp(context: MigrationContext): Promise<void>;
    preDown(context: MigrationContext): Promise<void>;
    down(context: MigrationContext): Promise<void>;
    verifyDown(context: MigrationContext): Promise<void>;
}
export interface MigrationEntry {
    id: string;
    checksum: string;
    migration: TransactionalMigration | StructuralMigration;
}

// Deliberately no Db, Session, arbitrary commands, DDL, upserts or aggregation writes.
export function migrationContext(db: Db, session: ClientSession, namespaces: string[]) {
    let pending: Promise<unknown> | undefined;
    let closed = false;
    let failure: unknown;
    function operation<T>(name: string, action: () => Promise<T>): Promise<T> {
        if (closed) throw new Error('Migration context is closed');
        if (pending) throw new Error('Parallel migration operations are forbidden; await every operation');
        if (!namespaces.includes(name) || name.startsWith('_tobu_') || name.startsWith('system.')) throw new Error('Undeclared/reserved migration namespace');
        const result = action();
        pending = result;
        // Register both handlers so a forgotten await does not create an unhandled rejection.
        void result.then(
            () => {
                pending = undefined;
            },
            (error) => {
                failure = error;
                pending = undefined;
            }
        );
        return result;
    }
    const context = Object.freeze({
        findOne: (name: string, filter: Filter<Document>) => operation(name, () => db.collection(name).findOne(filter, { session })),
        findMany: (name: string, filter: Filter<Document>, limit = 1000) => {
            if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('Use bounded batches; limit must be 1..10000');
            return operation(name, () => db.collection(name).find(filter, { session }).limit(limit).toArray());
        },
        count: (name: string, filter: Filter<Document>) => operation(name, () => db.collection(name).countDocuments(filter, { session })),
        insertOne: (name: string, document: Document) => operation(name, () => db.collection(name).insertOne(document, { session })),
        updateMany: (name: string, filter: Filter<Document>, update: UpdateFilter<Document>) => operation(name, () => db.collection(name).updateMany(filter, update, { session })),
        deleteMany: (name: string, filter: Filter<Document>) => operation(name, () => db.collection(name).deleteMany(filter, { session }))
    });
    return {
        context,
        async close() {
            closed = true;
            if (pending) {
                await pending;
                throw new Error('Migration returned with an unawaited database operation');
            }
            if (failure) throw failure;
        }
    };
}
