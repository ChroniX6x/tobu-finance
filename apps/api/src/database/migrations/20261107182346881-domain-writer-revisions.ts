import type { StructuralMigration, StructuralContext, CollectionSchema } from '../structural-types.js';
import type { Document } from 'mongodb';
// Frozen predecessor definitions. Optional revision is populated only by an actual future domain mutation.
// No backfill, changed financial fields, index changes or edits to earlier applied migrations.
const before: CollectionSchema[] = [
    {
        name: 'account_balances',
        validator: {
            $jsonSchema: {
                required: ['accountId', 'closingBalanceMinor', '_id'],
                properties: {
                    accountId: {
                        bsonType: 'objectId'
                    },
                    month: {
                        bsonType: ['date', 'null']
                    },
                    closingBalanceMinor: {
                        bsonType: 'number'
                    },
                    _id: {
                        bsonType: 'objectId'
                    }
                }
            }
        },
        indexes: [
            {
                key: {
                    accountId: 1,
                    month: 1
                },
                unique: true,
                sparse: true,
                background: true
            }
        ]
    },
    {
        name: 'carryovers',
        validator: {
            $jsonSchema: {
                required: ['accountId', 'memberId', 'amountMinor', '_id'],
                properties: {
                    accountId: {
                        bsonType: 'objectId'
                    },
                    memberId: {
                        bsonType: 'objectId'
                    },
                    month: {
                        bsonType: ['date', 'null']
                    },
                    amountMinor: {
                        bsonType: 'number'
                    },
                    reason: {
                        bsonType: ['string', 'null']
                    },
                    createdAt: {
                        bsonType: ['date', 'null']
                    },
                    _id: {
                        bsonType: 'objectId'
                    }
                }
            }
        },
        indexes: [
            {
                key: {
                    accountId: 1,
                    memberId: 1,
                    month: 1
                },
                unique: true,
                sparse: true,
                background: true
            }
        ]
    },
    {
        name: 'categories',
        validator: {
            $jsonSchema: {
                required: ['accountId', '_id'],
                properties: {
                    accountId: {
                        bsonType: 'objectId'
                    },
                    name: {
                        bsonType: ['string', 'null']
                    },
                    customSplit: {
                        bsonType: ['array', 'null'],
                        items: {
                            bsonType: ['object', 'null'],
                            required: ['memberId', 'split'],
                            properties: {
                                memberId: {
                                    bsonType: 'objectId'
                                },
                                split: {
                                    bsonType: 'number'
                                }
                            }
                        }
                    },
                    _id: {
                        bsonType: 'objectId'
                    },
                    createdAt: {
                        bsonType: ['date', 'null']
                    },
                    updatedAt: {
                        bsonType: ['date', 'null']
                    }
                }
            }
        },
        indexes: [
            {
                key: {
                    accountId: 1,
                    name: 1
                },
                background: true
            }
        ]
    },
    {
        name: 'category_budgets',
        validator: {
            $jsonSchema: {
                required: ['accountId', 'categoryId', 'amountMinor', '_id'],
                properties: {
                    accountId: {
                        bsonType: 'objectId'
                    },
                    categoryId: {
                        bsonType: 'objectId'
                    },
                    amountMinor: {
                        bsonType: 'number'
                    },
                    fromMonth: {
                        bsonType: ['date', 'null']
                    },
                    toMonth: {
                        bsonType: ['date', 'null']
                    },
                    _id: {
                        bsonType: 'objectId'
                    },
                    createdAt: {
                        bsonType: ['date', 'null']
                    },
                    updatedAt: {
                        bsonType: ['date', 'null']
                    }
                }
            }
        },
        indexes: []
    },
    {
        name: 'contribution_rules',
        validator: {
            $jsonSchema: {
                required: ['accountId', 'type', 'recurring', 'amountMinor', 'distribution', '_id'],
                properties: {
                    accountId: {
                        bsonType: 'objectId'
                    },
                    type: {
                        bsonType: 'string',
                        enum: ['base', 'additional', 'topup']
                    },
                    recurring: {
                        bsonType: 'bool'
                    },
                    description: {
                        bsonType: ['string', 'null']
                    },
                    amountMinor: {
                        bsonType: 'number'
                    },
                    distribution: {
                        required: ['mode'],
                        properties: {
                            mode: {
                                bsonType: 'string',
                                enum: ['perMember', 'customSplit', 'proRataIncome']
                            },
                            memberId: {
                                bsonType: ['objectId', 'null']
                            },
                            customSplit: {
                                bsonType: ['array', 'null'],
                                items: {
                                    bsonType: ['object', 'null'],
                                    required: ['memberId', 'split'],
                                    properties: {
                                        memberId: {
                                            bsonType: 'objectId'
                                        },
                                        split: {
                                            bsonType: 'number'
                                        }
                                    }
                                }
                            }
                        },
                        bsonType: 'object'
                    },
                    fromMonth: {
                        bsonType: ['date', 'null']
                    },
                    toMonth: {
                        bsonType: ['date', 'null']
                    },
                    meta: {
                        bsonType: ['object', 'null'],
                        properties: {
                            legacyTopUpDate: {
                                bsonType: ['string', 'null']
                            }
                        }
                    },
                    _id: {
                        bsonType: 'objectId'
                    },
                    createdAt: {
                        bsonType: ['date', 'null']
                    },
                    updatedAt: {
                        bsonType: ['date', 'null']
                    }
                }
            }
        },
        indexes: [
            {
                key: {
                    accountId: 1,
                    fromMonth: 1,
                    toMonth: 1,
                    type: 1
                },
                background: true
            }
        ]
    },
    {
        name: 'member_incomes',
        validator: {
            $jsonSchema: {
                required: ['accountId', 'memberId', 'amountMinor', '_id'],
                properties: {
                    accountId: {
                        bsonType: 'objectId'
                    },
                    memberId: {
                        bsonType: 'objectId'
                    },
                    amountMinor: {
                        bsonType: 'number'
                    },
                    fromMonth: {
                        bsonType: ['date', 'null']
                    },
                    toMonth: {
                        bsonType: ['date', 'null']
                    },
                    source: {
                        bsonType: ['string', 'null']
                    },
                    note: {
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
                    }
                }
            }
        },
        indexes: [
            {
                key: {
                    accountId: 1,
                    memberId: 1,
                    fromMonth: 1,
                    toMonth: 1
                },
                background: true
            }
        ]
    },
    {
        name: 'recurrences',
        validator: {
            $jsonSchema: {
                required: ['accountId', 'type', 'amountMinor', 'schedule', 'activeFrom', '_id'],
                properties: {
                    accountId: {
                        bsonType: 'objectId'
                    },
                    categoryId: {
                        bsonType: ['objectId', 'null']
                    },
                    title: {
                        bsonType: ['string', 'null']
                    },
                    type: {
                        bsonType: 'string',
                        enum: ['income', 'expense']
                    },
                    amountMinor: {
                        bsonType: 'number'
                    },
                    isFromSharedAccount: {
                        bsonType: ['bool', 'null']
                    },
                    schedule: {
                        properties: {
                            freq: {
                                bsonType: ['string', 'null'],
                                enum: ['monthly', null]
                            },
                            dayOfMonth: {
                                bsonType: ['number', 'null']
                            }
                        },
                        bsonType: 'object'
                    },
                    activeFrom: {
                        bsonType: 'date'
                    },
                    activeUntil: {
                        bsonType: ['date', 'null']
                    },
                    createdByMemberId: {
                        bsonType: ['objectId', 'null']
                    },
                    nextPlanned: {
                        bsonType: ['date', 'null']
                    },
                    lastEmitted: {
                        bsonType: ['date', 'null']
                    },
                    _id: {
                        bsonType: 'objectId'
                    },
                    createdAt: {
                        bsonType: ['date', 'null']
                    },
                    updatedAt: {
                        bsonType: ['date', 'null']
                    }
                }
            }
        },
        indexes: [
            {
                key: {
                    accountId: 1,
                    nextPlanned: 1
                },
                background: true
            }
        ]
    },
    {
        name: 'transactions',
        validator: {
            $jsonSchema: {
                required: ['accountId', 'title', 'type', 'amountMinor', 'month', 'isFromSharedAccount', '_id'],
                properties: {
                    accountId: {
                        bsonType: 'objectId'
                    },
                    categoryId: {
                        bsonType: ['objectId', 'null']
                    },
                    title: {
                        bsonType: 'string'
                    },
                    notes: {
                        bsonType: ['string', 'null']
                    },
                    type: {
                        bsonType: 'string',
                        enum: ['income', 'expense']
                    },
                    amountMinor: {
                        bsonType: 'number'
                    },
                    month: {
                        bsonType: 'date'
                    },
                    bookDate: {
                        bsonType: ['date', 'null']
                    },
                    status: {
                        bsonType: ['string', 'null'],
                        enum: ['booked', 'pending', null]
                    },
                    isFromSharedAccount: {
                        bsonType: 'bool'
                    },
                    paidByMemberId: {
                        bsonType: ['objectId', 'null']
                    },
                    parentTransactionId: {
                        bsonType: ['objectId', 'null']
                    },
                    recurrenceId: {
                        bsonType: ['objectId', 'null']
                    },
                    _id: {
                        bsonType: 'objectId'
                    },
                    createdAt: {
                        bsonType: ['date', 'null']
                    },
                    updatedAt: {
                        bsonType: ['date', 'null']
                    }
                }
            }
        },
        indexes: [
            {
                key: {
                    accountId: 1,
                    month: 1,
                    status: 1
                },
                background: true
            },
            {
                key: {
                    accountId: 1,
                    bookDate: -1
                },
                background: true
            },
            {
                key: {
                    categoryId: 1,
                    month: 1
                },
                background: true
            },
            {
                key: {
                    paidByMemberId: 1,
                    month: 1
                },
                background: true
            },
            {
                key: {
                    accountId: 1,
                    parentTransactionId: 1
                },
                background: true
            },
            {
                key: {
                    parentTransactionId: 1
                },
                background: true
            }
        ]
    }
];
const after = before.map((schema) => ({
    ...schema,
    validator: { $jsonSchema: { ...schema.validator.$jsonSchema, properties: { ...schema.validator.$jsonSchema.properties, mutationVersion: { bsonType: ['int', 'double'], multipleOf: 1, minimum: 0, maximum: 9007199254740991 } } } }
}));
const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => (item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item));
async function matches(context: StructuralContext, schema: CollectionSchema) {
    const info = await context.info(schema.name);
    if (!info || (info.options?.validationLevel && info.options.validationLevel !== 'strict') || (info.options?.validationAction && info.options.validationAction !== 'error')) return false;
    if (canonical(info.options?.validator) !== canonical(schema.validator)) return false;
    const actual = (await context.indexes(schema.name)).map((i) => Object.fromEntries(Object.entries(i).filter(([key]) => key !== 'v')));
    const expected = [
        { key: { _id: 1 }, name: '_id_' },
        ...schema.indexes.map((i) => ({
            ...i,
            name:
                i.name ??
                Object.entries(i.key)
                    .map(([k, v]) => k + '_' + v)
                    .join('_')
        }))
    ];
    const ordered = (items: Document[]) => [...items].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((i) => ({ ...i, key: Object.entries(i.key) }));
    return canonical(ordered(actual)) === canonical(ordered(expected));
}
async function requireSchemas(context: StructuralContext, schemas: CollectionSchema[]) {
    for (const schema of schemas) if (!(await matches(context, schema))) throw new Error('Unexpected domain revision schema state');
}
function step(previous: CollectionSchema, next: CollectionSchema) {
    return {
        id: 'revision-' + next.name.replaceAll('_', '-'),
        async inspect(context: StructuralContext) {
            return (await matches(context, previous)) ? ('before' as const) : (await matches(context, next)) ? ('after' as const) : ('ambiguous' as const);
        },
        async apply(context: StructuralContext) {
            await context.validator(next.name, next.validator);
        },
        async verify(context: StructuralContext) {
            if (!(await matches(context, next))) throw new Error('Domain revision validator verification failed');
        }
    };
}
export const migration: StructuralMigration = {
    type: 'structural',
    predecessor: '20261107163516618-member-activity',
    description: 'Add optional integer domain mutation revisions for atomic writer CAS; preserve all existing data and indexes',
    namespaces: before.map((s) => s.name),
    schemaChanges: Object.fromEntries(after.map((s) => [s.name, s])),
    async preUp(context) {
        await requireSchemas(context, before);
        for (const schema of after) if (await context.count(schema.name, { $nor: [schema.validator] })) throw new Error('Existing revision values require a read-only audit and separate data decision');
    },
    async preDown(context) {
        await requireSchemas(context, after);
        for (const schema of before) if (await context.count(schema.name, { $nor: [schema.validator] })) throw new Error('Existing values are incompatible with the predecessor validator');
    },
    up: before.map((schema, i) => step(schema, after[i]!)),
    down: [...after].reverse().map((schema) => step(schema, before.find((s) => s.name === schema.name)!)),
    verifyUp: (context) => requireSchemas(context, after),
    verifyDown: (context) => requireSchemas(context, before)
};
