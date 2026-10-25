import type { Db, Document, Filter, IndexDescription, UpdateFilter } from 'mongodb';

export function structuralContext(db: Db, namespaces: string[], runId: string, assertOwner: () => Promise<void>, readOnly = false) {
    let closed = false;
    let pending: Promise<unknown> | undefined;
    let failure: unknown;
    const checkName = (name: string) => {
        if (!namespaces.includes(name) || !/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Undeclared/reserved structural namespace');
    };
    function operation<T>(name: string, write: boolean, action: () => Promise<T>): Promise<T> {
        checkName(name);
        if (closed || pending || (write && readOnly)) throw new Error('Closed, concurrent or read-only structural operation');
        const result = (async () => {
            await assertOwner();
            return action();
        })();
        pending = result;
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
    const options = { comment: runId, writeConcern: { w: 'majority' as const } };
    const context = Object.freeze({
        info: (name: string) => operation(name, false, () => db.listCollections({ name }, { nameOnly: false }).next()),
        indexes: (name: string) => operation(name, false, () => db.collection(name).listIndexes({ comment: runId }).toArray()),
        count: (name: string, filter: Filter<Document>) => operation(name, false, () => db.collection(name).countDocuments(filter, { comment: runId })),
        find: (name: string, filter: Filter<Document>, limit = 1000) => {
            if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('Structural reads must be bounded');
            return operation(name, false, () => db.collection(name).find(filter, { comment: runId }).sort({ _id: 1 }).limit(limit).toArray());
        },
        updateMany: (name: string, filter: Filter<Document>, update: UpdateFilter<Document>) => operation(name, true, () => db.collection(name).updateMany(filter, update, options)),
        insertMany: (name: string, documents: Document[]) => operation(name, true, () => db.collection(name).insertMany(documents, options)),
        create: (name: string, validator: Document) => operation(name, true, () => db.createCollection(name, { validator, ...options })),
        validator: (name: string, validator: Document) => operation(name, true, () => db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error', ...options })),
        createIndexes: (name: string, indexes: IndexDescription[]) =>
            operation(name, true, () => {
                if (indexes.some((index) => !index.name)) throw new Error('Structural indexes require explicit stable names');
                return db.command({ createIndexes: name, indexes, ...options });
            }),
        dropIndex: (name: string, index: string) => operation(name, true, () => db.command({ dropIndexes: name, index, ...options })),
        drop: (name: string) => operation(name, true, () => db.command({ drop: name, ...options })),
        rename: (name: string, destination: string) => {
            checkName(destination);
            return operation(name, true, () => db.admin().command({ renameCollection: `${db.databaseName}.${name}`, to: `${db.databaseName}.${destination}`, dropTarget: false, ...options }));
        }
    });
    return {
        context,
        async close() {
            closed = true;
            if (pending) {
                await pending;
                throw new Error('Unawaited structural operation');
            }
            if (failure) throw failure;
        }
    };
}
