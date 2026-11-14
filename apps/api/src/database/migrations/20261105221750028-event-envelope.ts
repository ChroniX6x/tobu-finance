import type { StructuralMigration, StructuralContext, CollectionSchema } from '../structural-types.js';
import type { Document, IndexDescription } from 'mongodb';

// E03 expansion only. Frozen E01 envelope, no backfill, no event or actor reconstruction.
// Never edit after an application, including after Down. New catalog codes require a new migration.
const before: CollectionSchema = {
    name: 'events',
    validator: {
        $jsonSchema: {
            required: ['accountId', 'date', 'code', 'params', '_id'],
            properties: {
                accountId: {
                    bsonType: 'objectId'
                },
                date: {
                    bsonType: 'date'
                },
                code: {
                    bsonType: 'string'
                },
                params: {},
                createdByMemberId: {
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
                },
                __v: {
                    bsonType: ['number', 'null']
                }
            }
        }
    },
    indexes: [
        {
            key: {
                accountId: 1,
                date: -1
            },
            background: true
        }
    ]
};
export const eventEnvelopeValidator: Document = {
    $and: [
        {
            $jsonSchema: {
                required: ['accountId', 'date', 'code', 'params', '_id'],
                properties: {
                    accountId: {
                        bsonType: 'objectId'
                    },
                    date: {
                        bsonType: 'date'
                    },
                    code: {
                        bsonType: 'string'
                    },
                    params: {},
                    createdByMemberId: {
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
                    },
                    __v: {
                        bsonType: ['number', 'null']
                    }
                }
            }
        },
        {
            $or: [
                {
                    schemaVersion: {
                        $exists: false
                    }
                },
                {
                    $and: [
                        {
                            $jsonSchema: {
                                required: ['accountId', 'date', 'code', 'params', 'schemaVersion', 'actor', 'trigger', 'subject'],
                                additionalProperties: false,
                                properties: {
                                    accountId: {
                                        bsonType: 'objectId'
                                    },
                                    date: {
                                        bsonType: 'date'
                                    },
                                    code: {
                                        bsonType: 'string'
                                    },
                                    params: {},
                                    createdByMemberId: {
                                        bsonType: 'null'
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
                                    schemaVersion: {
                                        bsonType: ['int', 'double'],
                                        enum: [1]
                                    },
                                    actor: {
                                        anyOf: [
                                            {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        bsonType: ['string'],
                                                        enum: ['user']
                                                    },
                                                    userId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'userId'],
                                                additionalProperties: false
                                            },
                                            {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        bsonType: ['string'],
                                                        enum: ['system']
                                                    }
                                                },
                                                required: ['kind'],
                                                additionalProperties: false
                                            }
                                        ]
                                    },
                                    trigger: {
                                        anyOf: [
                                            {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        bsonType: ['string'],
                                                        enum: ['user_action']
                                                    }
                                                },
                                                required: ['kind'],
                                                additionalProperties: false
                                            },
                                            {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        bsonType: ['string'],
                                                        enum: ['account_open', 'automation', 'system_reconciliation']
                                                    },
                                                    initiatedByUserId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind'],
                                                additionalProperties: false
                                            }
                                        ]
                                    },
                                    subject: {
                                        bsonType: ['object'],
                                        properties: {
                                            kind: {
                                                bsonType: ['string'],
                                                enum: ['account', 'member', 'transaction', 'category', 'memberIncome', 'contributionRule', 'categoryBudget', 'carryOver', 'accountBalance', 'legacyRecurrence']
                                            },
                                            id: {
                                                bsonType: ['string'],
                                                pattern: '^[a-f\\d]{24}$'
                                            }
                                        },
                                        required: ['kind', 'id'],
                                        additionalProperties: false
                                    },
                                    commandId: {
                                        bsonType: ['string'],
                                        pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'
                                    },
                                    correlationId: {
                                        bsonType: ['string'],
                                        pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'
                                    },
                                    batchId: {
                                        bsonType: ['string'],
                                        pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'
                                    }
                                },
                                oneOf: [
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['transaction.created']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    transactionId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    type: {
                                                        bsonType: ['string'],
                                                        enum: ['income', 'expense']
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    },
                                                    title: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 120
                                                    },
                                                    categoryId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['transactionId', 'type', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['transaction']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['transaction.splitChildCreated']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    transactionId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    parentTransactionId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    type: {
                                                        bsonType: ['string'],
                                                        enum: ['income', 'expense']
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    },
                                                    title: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 120
                                                    },
                                                    categoryId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['transactionId', 'parentTransactionId', 'type', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['transaction']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['transaction.booked']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    transactionId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    type: {
                                                        bsonType: ['string'],
                                                        enum: ['income', 'expense']
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    },
                                                    title: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 120
                                                    }
                                                },
                                                required: ['transactionId', 'type', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['transaction']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['transaction.statusChanged']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    transactionId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    from: {
                                                        bsonType: ['string'],
                                                        enum: ['booked', 'pending']
                                                    },
                                                    to: {
                                                        bsonType: ['string'],
                                                        enum: ['booked', 'pending']
                                                    },
                                                    title: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 120
                                                    }
                                                },
                                                required: ['transactionId', 'from', 'to'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['transaction']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['transaction.updated']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    transactionId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    changedFields: {
                                                        minItems: 1,
                                                        maxItems: 10,
                                                        bsonType: ['array'],
                                                        items: {
                                                            bsonType: ['string'],
                                                            enum: ['title', 'notes', 'amountMinor', 'type', 'categoryId', 'paidByMemberId', 'isFromSharedAccount', 'recurrenceId', 'bookDate', 'month']
                                                        },
                                                        uniqueItems: true
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['object'],
                                                        properties: {
                                                            from: {
                                                                bsonType: ['int', 'double'],
                                                                multipleOf: 1,
                                                                minimum: 0,
                                                                maximum: 9007199254740991
                                                            },
                                                            to: {
                                                                bsonType: ['int', 'double'],
                                                                multipleOf: 1,
                                                                minimum: 0,
                                                                maximum: 9007199254740991
                                                            }
                                                        },
                                                        required: ['from', 'to'],
                                                        additionalProperties: false
                                                    },
                                                    categoryId: {
                                                        bsonType: ['object'],
                                                        properties: {
                                                            from: {
                                                                anyOf: [
                                                                    {
                                                                        bsonType: ['string'],
                                                                        pattern: '^[a-f\\d]{24}$'
                                                                    },
                                                                    {
                                                                        bsonType: ['null']
                                                                    }
                                                                ]
                                                            },
                                                            to: {
                                                                anyOf: [
                                                                    {
                                                                        bsonType: ['string'],
                                                                        pattern: '^[a-f\\d]{24}$'
                                                                    },
                                                                    {
                                                                        bsonType: ['null']
                                                                    }
                                                                ]
                                                            }
                                                        },
                                                        required: ['from', 'to'],
                                                        additionalProperties: false
                                                    },
                                                    title: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 120
                                                    }
                                                },
                                                required: ['transactionId', 'changedFields'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['transaction']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['transaction.deleted']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    transactionId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    type: {
                                                        bsonType: ['string'],
                                                        enum: ['income', 'expense']
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    },
                                                    title: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 120
                                                    },
                                                    childCount: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    }
                                                },
                                                required: ['transactionId', 'type', 'amountMinor', 'childCount'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['transaction']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['transaction.splitChildDeleted']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    transactionId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    parentTransactionId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['transactionId', 'parentTransactionId'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['transaction']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['category.created']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    categoryId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    name: {
                                                        anyOf: [
                                                            {
                                                                bsonType: ['string'],
                                                                minLength: 1,
                                                                maxLength: 80
                                                            },
                                                            {
                                                                bsonType: ['null']
                                                            }
                                                        ]
                                                    }
                                                },
                                                required: ['categoryId', 'name'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['category']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['category.updated']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    categoryId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    changedFields: {
                                                        minItems: 1,
                                                        maxItems: 2,
                                                        bsonType: ['array'],
                                                        items: {
                                                            bsonType: ['string'],
                                                            enum: ['name', 'customSplit']
                                                        },
                                                        uniqueItems: true
                                                    },
                                                    name: {
                                                        anyOf: [
                                                            {
                                                                bsonType: ['string'],
                                                                minLength: 1,
                                                                maxLength: 80
                                                            },
                                                            {
                                                                bsonType: ['null']
                                                            }
                                                        ]
                                                    }
                                                },
                                                required: ['categoryId', 'changedFields'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['category']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['category.deleted']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    categoryId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    name: {
                                                        anyOf: [
                                                            {
                                                                bsonType: ['string'],
                                                                minLength: 1,
                                                                maxLength: 80
                                                            },
                                                            {
                                                                bsonType: ['null']
                                                            }
                                                        ]
                                                    }
                                                },
                                                required: ['categoryId', 'name'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['category']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['account.created']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    currency: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 64
                                                    }
                                                },
                                                required: ['currency'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['account']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['account.settings.updated']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    changedFields: {
                                                        minItems: 1,
                                                        maxItems: 3,
                                                        bsonType: ['array'],
                                                        items: {
                                                            bsonType: ['string'],
                                                            enum: ['name', 'currency', 'settings']
                                                        },
                                                        uniqueItems: true
                                                    }
                                                },
                                                required: ['changedFields'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['account']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['account.member.added']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    memberId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    role: {
                                                        bsonType: ['string'],
                                                        enum: ['owner', 'member']
                                                    }
                                                },
                                                required: ['memberId'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['member']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['account.member.removed']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    memberId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['memberId'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['member']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['account.member.roleChanged']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    memberId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    from: {
                                                        bsonType: ['string'],
                                                        enum: ['owner', 'member']
                                                    },
                                                    to: {
                                                        bsonType: ['string'],
                                                        enum: ['owner', 'member']
                                                    }
                                                },
                                                required: ['memberId', 'from', 'to'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['member']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['memberIncome.added']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    memberId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    }
                                                },
                                                required: ['memberId', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['memberIncome']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['memberIncome.updated']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    memberId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    }
                                                },
                                                required: ['memberId', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['memberIncome']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['memberIncome.removed']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    memberId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['memberId'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['memberIncome']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['contributionRule.added']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    ruleId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    ruleType: {
                                                        bsonType: ['string'],
                                                        enum: ['additional', 'topup']
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    }
                                                },
                                                required: ['ruleId', 'ruleType', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['contributionRule']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['contributionRule.updated']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    ruleId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    ruleType: {
                                                        bsonType: ['string'],
                                                        enum: ['additional', 'topup']
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    }
                                                },
                                                required: ['ruleId', 'ruleType', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['contributionRule']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['contributionRule.removed']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    ruleId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    ruleType: {
                                                        bsonType: ['string'],
                                                        enum: ['additional', 'topup']
                                                    }
                                                },
                                                required: ['ruleId', 'ruleType'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['contributionRule']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['categoryBudget.added']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    categoryId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    }
                                                },
                                                required: ['categoryId', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['categoryBudget']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['categoryBudget.updated']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    categoryId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: 0,
                                                        maximum: 9007199254740991
                                                    }
                                                },
                                                required: ['categoryId', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['categoryBudget']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['categoryBudget.removed']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    categoryId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['categoryId'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['categoryBudget']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['carryOver.set']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    memberId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    month: {
                                                        anyOf: [
                                                            {
                                                                bsonType: ['string'],
                                                                pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                            },
                                                            {
                                                                bsonType: ['null']
                                                            }
                                                        ]
                                                    },
                                                    amountMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: -9007199254740991,
                                                        maximum: 9007199254740991
                                                    }
                                                },
                                                required: ['memberId', 'month', 'amountMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['carryOver']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['carryOver.removed']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    memberId: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    },
                                                    month: {
                                                        anyOf: [
                                                            {
                                                                bsonType: ['string'],
                                                                pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                            },
                                                            {
                                                                bsonType: ['null']
                                                            }
                                                        ]
                                                    }
                                                },
                                                required: ['memberId', 'month'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['carryOver']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['accountBalance.set']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    month: {
                                                        anyOf: [
                                                            {
                                                                bsonType: ['string'],
                                                                pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                            },
                                                            {
                                                                bsonType: ['null']
                                                            }
                                                        ]
                                                    },
                                                    closingBalanceMinor: {
                                                        bsonType: ['int', 'double'],
                                                        multipleOf: 1,
                                                        minimum: -9007199254740991,
                                                        maximum: 9007199254740991
                                                    }
                                                },
                                                required: ['month', 'closingBalanceMinor'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['accountBalance']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['accountBalance.removed']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    month: {
                                                        anyOf: [
                                                            {
                                                                bsonType: ['string'],
                                                                pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                            },
                                                            {
                                                                bsonType: ['null']
                                                            }
                                                        ]
                                                    }
                                                },
                                                required: ['month'],
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['accountBalance']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['legacyRecurrence.created']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    title: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 120
                                                    }
                                                },
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['legacyRecurrence']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['legacyRecurrence.updated']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    title: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 120
                                                    }
                                                },
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['legacyRecurrence']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    {
                                        required: ['code', 'params', 'subject'],
                                        properties: {
                                            code: {
                                                enum: ['legacyRecurrence.deleted']
                                            },
                                            params: {
                                                bsonType: ['object'],
                                                properties: {
                                                    title: {
                                                        bsonType: ['string'],
                                                        minLength: 1,
                                                        maxLength: 120
                                                    }
                                                },
                                                additionalProperties: false
                                            },
                                            subject: {
                                                bsonType: ['object'],
                                                properties: {
                                                    kind: {
                                                        enum: ['legacyRecurrence']
                                                    },
                                                    id: {
                                                        bsonType: ['string'],
                                                        pattern: '^[a-f\\d]{24}$'
                                                    }
                                                },
                                                required: ['kind', 'id'],
                                                additionalProperties: false
                                            }
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $or: [
                                {
                                    'actor.kind': 'user',
                                    'trigger.kind': 'user_action'
                                },
                                {
                                    'actor.kind': 'system',
                                    'trigger.kind': {
                                        $in: ['account_open', 'automation', 'system_reconciliation']
                                    }
                                }
                            ]
                        },
                        {
                            $or: [
                                {
                                    code: 'transaction.created',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.transactionId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'transaction.splitChildCreated',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.transactionId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'transaction.booked',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.transactionId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'transaction.statusChanged',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.transactionId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'transaction.updated',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.transactionId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'transaction.deleted',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.transactionId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'transaction.splitChildDeleted',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.transactionId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'category.created',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.categoryId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'category.updated',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.categoryId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'category.deleted',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.categoryId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'account.created',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: {
                                                    $toString: '$accountId'
                                                }
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'account.settings.updated',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: {
                                                    $toString: '$accountId'
                                                }
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'account.member.added',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.memberId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'account.member.removed',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.memberId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'account.member.roleChanged',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.memberId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'memberIncome.added'
                                },
                                {
                                    code: 'memberIncome.updated'
                                },
                                {
                                    code: 'memberIncome.removed'
                                },
                                {
                                    code: 'contributionRule.added',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.ruleId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'contributionRule.updated',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.ruleId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'contributionRule.removed',
                                    $expr: {
                                        $eq: [
                                            {
                                                $toLower: '$subject.id'
                                            },
                                            {
                                                $toLower: '$params.ruleId'
                                            }
                                        ]
                                    }
                                },
                                {
                                    code: 'categoryBudget.added'
                                },
                                {
                                    code: 'categoryBudget.updated'
                                },
                                {
                                    code: 'categoryBudget.removed'
                                },
                                {
                                    code: 'carryOver.set'
                                },
                                {
                                    code: 'carryOver.removed'
                                },
                                {
                                    code: 'accountBalance.set'
                                },
                                {
                                    code: 'accountBalance.removed'
                                },
                                {
                                    code: 'legacyRecurrence.created'
                                },
                                {
                                    code: 'legacyRecurrence.updated'
                                },
                                {
                                    code: 'legacyRecurrence.deleted'
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};
const index: IndexDescription = {
    key: {
        accountId: 1,
        date: -1,
        _id: -1
    },
    name: 'accountId_1_date_-1__id_-1',
    background: true
};
const after: CollectionSchema = { name: 'events', validator: eventEnvelopeValidator, indexes: [...before.indexes, index] };
const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => (item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item));
const expectedIndexes = (schema: CollectionSchema) => [
    { key: { _id: 1 }, name: '_id_' },
    ...schema.indexes.map((item) => ({
        ...item,
        name:
            item.name ??
            Object.entries(item.key)
                .map(([key, direction]) => key + '_' + direction)
                .join('_')
    }))
];
async function state(context: StructuralContext): Promise<'before' | 'expanded' | 'after' | 'ambiguous'> {
    const info = await context.info('events');
    const options = info?.options ?? {};
    if (!info || (options.validationLevel && options.validationLevel !== 'strict') || (options.validationAction && options.validationAction !== 'error')) return 'ambiguous';
    const indexes = (await context.indexes('events')).map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'v')));
    const ordered = (items: Document[]) => [...items].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((item) => ({ ...item, key: Object.entries(item.key) }));
    const matches = (schema: CollectionSchema) => canonical(options.validator) === canonical(schema.validator) && canonical(ordered(indexes)) === canonical(ordered(expectedIndexes(schema)));
    if (matches(before)) return 'before';
    if (matches(after)) return 'after';
    if (matches({ ...before, validator: eventEnvelopeValidator })) return 'expanded';
    return 'ambiguous';
}
async function requireState(context: StructuralContext, expected: string) {
    if ((await state(context)) !== expected) throw new Error('Unexpected event envelope migration schema state');
}
export const migration: StructuralMigration = {
    type: 'structural',
    predecessor: '2026-10-v1',
    description: 'Add typed event envelope validation and stable account/date/id index; retain all legacy events',
    namespaces: ['events'],
    schemaChanges: { events: after },
    async preUp(context) {
        await requireState(context, 'before');
        if (await context.count('events', { $nor: [eventEnvelopeValidator] })) throw new Error('Existing events incompatible with envelope expansion; read-only audit and separate data decision required');
    },
    preDown: (context) => requireState(context, 'after'),
    up: [
        {
            id: 'expand-validator',
            async inspect(context) {
                const s = await state(context);
                return s === 'before' ? 'before' : ['expanded', 'after'].includes(s) ? 'after' : 'ambiguous';
            },
            async apply(context) {
                await context.validator('events', eventEnvelopeValidator);
            },
            async verify(context) {
                if (!['expanded', 'after'].includes(await state(context))) throw new Error('Event validator verification failed');
            }
        },
        {
            id: 'add-query-index',
            async inspect(context) {
                const s = await state(context);
                return s === 'expanded' ? 'before' : s === 'after' ? 'after' : 'ambiguous';
            },
            async apply(context) {
                await context.createIndexes('events', [index]);
            },
            verify: (context) => requireState(context, 'after')
        }
    ],
    down: [
        {
            id: 'remove-query-index',
            async inspect(context) {
                const s = await state(context);
                return s === 'after' ? 'before' : ['expanded', 'before'].includes(s) ? 'after' : 'ambiguous';
            },
            async apply(context) {
                await context.dropIndex('events', 'accountId_1_date_-1__id_-1');
            },
            async verify(context) {
                if (!['expanded', 'before'].includes(await state(context))) throw new Error('Event index removal verification failed');
            }
        },
        {
            id: 'restore-validator',
            async inspect(context) {
                const s = await state(context);
                return s === 'expanded' ? 'before' : s === 'before' ? 'after' : 'ambiguous';
            },
            async apply(context) {
                await context.validator('events', before.validator);
            },
            verify: (context) => requireState(context, 'before')
        }
    ],
    verifyUp: (context) => requireState(context, 'after'),
    verifyDown: (context) => requireState(context, 'before')
};
