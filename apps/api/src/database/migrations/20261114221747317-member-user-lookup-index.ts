import type { StructuralMigration, StructuralContext, CollectionSchema } from '../structural-types.js';

// Frozen E05 member schema; the lookup index is additive and deliberately nonunique.
const beforeMembers: CollectionSchema = {
    name: 'members',
    validator: {
        $jsonSchema: {
            required: ['_id'],
            properties: {
                name: {
                    bsonType: ['string', 'null']
                },
                email: {
                    bsonType: ['string', 'null']
                },
                userId: {
                    bsonType: ['objectId', 'null']
                },
                avatar: {
                    bsonType: ['string', 'null']
                },
                _id: {
                    bsonType: 'objectId'
                },
                createdAt: {
                    bsonType: ['date', 'null']
                },
                updatedAt: {
                    bsonType: ['date', 'null']
                },
                __v: {
                    bsonType: ['number', 'null']
                },
                createdByUserId: {
                    bsonType: 'objectId'
                }
            }
        }
    },
    indexes: []
};
const afterMembers: CollectionSchema = { ...beforeMembers, indexes: [{ key: { userId: 1 }, name: 'userId_1' }] };
const canonical = (v: unknown) => JSON.stringify(v, (_key, item) => (item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item));
async function matches(context: StructuralContext, expected: CollectionSchema) {
    const info = await context.info('members');
    if (!info || (info.options?.validationLevel && info.options.validationLevel !== 'strict') || (info.options?.validationAction && info.options.validationAction !== 'error') || canonical(info.options?.validator) !== canonical(expected.validator))
        return false;
    const actual = (await context.indexes('members')).map((index) => Object.fromEntries(Object.entries(index).filter(([key]) => key !== 'v')));
    const wanted = [{ key: { _id: 1 }, name: '_id_' }, ...expected.indexes.map((index) => Object.fromEntries(Object.entries(index)))];
    const ordered = (items: typeof actual) => [...items].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((index) => ({ ...index, key: Object.entries(index.key as Record<string, unknown>) }));
    return canonical(ordered(actual)) === canonical(ordered(wanted));
}
async function requireState(context: StructuralContext, state: CollectionSchema) {
    if (!(await matches(context, state))) throw new Error('Unexpected P02 member lookup schema; inspect before recovery');
}
const step = (down: boolean) => ({
    id: down ? 'remove-user-lookup' : 'add-user-lookup',
    async inspect(context: StructuralContext) {
        const before = down ? afterMembers : beforeMembers;
        const after = down ? beforeMembers : afterMembers;
        return (await matches(context, before)) ? ('before' as const) : (await matches(context, after)) ? ('after' as const) : ('ambiguous' as const);
    },
    async apply(context: StructuralContext) {
        if (down) await context.dropIndex('members', 'userId_1');
        else await context.createIndexes('members', afterMembers.indexes);
    },
    async verify(context: StructuralContext) {
        await requireState(context, down ? beforeMembers : afterMembers);
    }
});
export const migration: StructuralMigration = {
    type: 'structural',
    predecessor: '20261108172127336-recurrence-activity-primitives',
    description: 'Index trusted user-to-member lookups without relinking or deduplicating historical people',
    namespaces: ['members'],
    schemaChanges: { members: afterMembers },
    preUp: (context) => requireState(context, beforeMembers),
    preDown: (context) => requireState(context, afterMembers),
    up: [step(false)],
    down: [step(true)],
    verifyUp: (context) => requireState(context, afterMembers),
    verifyDown: (context) => requireState(context, beforeMembers)
};
