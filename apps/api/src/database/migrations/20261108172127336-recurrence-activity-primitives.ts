import type { StructuralMigration, StructuralContext, CollectionSchema } from '../structural-types.js';
import type { Document } from 'mongodb';
// Frozen E05 predecessor and additive E07 event contracts. No domain collection, backfill or runtime imports.
const beforeEvents: CollectionSchema = {
    name: 'events',
    validator: {
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
                                        },
                                        {
                                            required: ['code', 'params', 'subject'],
                                            properties: {
                                                code: {
                                                    enum: ['member.updated']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    additionalProperties: false,
                                                    required: ['memberId', 'changedFields'],
                                                    properties: {
                                                        memberId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        changedFields: {
                                                            bsonType: 'array',
                                                            items: {
                                                                enum: ['name', 'email']
                                                            },
                                                            minItems: 1,
                                                            maxItems: 2,
                                                            uniqueItems: true
                                                        }
                                                    }
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
                                    },
                                    {
                                        code: 'member.updated',
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
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    },
    indexes: [
        {
            key: {
                accountId: 1,
                date: -1
            },
            background: true
        },
        {
            key: {
                accountId: 1,
                date: -1,
                _id: -1
            },
            name: 'accountId_1_date_-1__id_-1',
            background: true
        }
    ]
};
const afterEvents: CollectionSchema = {
    name: 'events',
    validator: {
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
                                                    enum: ['account', 'member', 'transaction', 'category', 'memberIncome', 'contributionRule', 'categoryBudget', 'carryOver', 'accountBalance', 'legacyRecurrence', 'recurrence', 'occurrence']
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
                                        },
                                        {
                                            required: ['code', 'params', 'subject'],
                                            properties: {
                                                code: {
                                                    enum: ['member.updated']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    additionalProperties: false,
                                                    required: ['memberId', 'changedFields'],
                                                    properties: {
                                                        memberId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        changedFields: {
                                                            bsonType: 'array',
                                                            items: {
                                                                enum: ['name', 'email']
                                                            },
                                                            minItems: 1,
                                                            maxItems: 2,
                                                            uniqueItems: true
                                                        }
                                                    }
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
                                                    enum: ['recurrence.created']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        revisionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        title: {
                                                            bsonType: 'string',
                                                            minLength: 1,
                                                            maxLength: 120
                                                        }
                                                    },
                                                    required: ['recurrenceId', 'revisionId'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['recurrence']
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
                                                    enum: ['recurrence.config.updated']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        revisionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        previousRevisionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        changedFields: {
                                                            minItems: 1,
                                                            maxItems: 10,
                                                            bsonType: 'array',
                                                            items: {
                                                                bsonType: 'string',
                                                                enum: ['title', 'type', 'expectedAmountMinor', 'categoryId', 'source', 'paidByMemberId', 'startMonth', 'intervalMonths', 'dayOfMonth', 'notes']
                                                            },
                                                            uniqueItems: true
                                                        }
                                                    },
                                                    required: ['recurrenceId', 'revisionId', 'changedFields'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['recurrence']
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
                                                    enum: ['recurrence.activated']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        }
                                                    },
                                                    required: ['recurrenceId'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['recurrence']
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
                                                    enum: ['recurrence.deactivated']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        }
                                                    },
                                                    required: ['recurrenceId'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['recurrence']
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
                                                    enum: ['recurrence.revision.discarded']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        revisionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        restoredRevisionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        }
                                                    },
                                                    required: ['recurrenceId', 'revisionId'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['recurrence']
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
                                                    enum: ['recurrence.deleted']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        }
                                                    },
                                                    required: ['recurrenceId'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['recurrence']
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
                                                    enum: ['occurrence.generated']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        revisionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        occurrenceKey: {
                                                            bsonType: 'string',
                                                            pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                        },
                                                        transactionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        }
                                                    },
                                                    required: ['recurrenceId', 'revisionId', 'occurrenceKey', 'transactionId'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['occurrence']
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
                                                    enum: ['occurrence.skipped']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        occurrenceKey: {
                                                            bsonType: 'string',
                                                            pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                        }
                                                    },
                                                    required: ['recurrenceId', 'occurrenceKey'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['occurrence']
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
                                                    enum: ['occurrence.unskipped']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        occurrenceKey: {
                                                            bsonType: 'string',
                                                            pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                        },
                                                        choice: {
                                                            bsonType: 'string',
                                                            enum: ['generate', 'release']
                                                        }
                                                    },
                                                    required: ['recurrenceId', 'occurrenceKey'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['occurrence']
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
                                                    enum: ['occurrence.linked']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        occurrenceKey: {
                                                            bsonType: 'string',
                                                            pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                        },
                                                        transactionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        }
                                                    },
                                                    required: ['recurrenceId', 'occurrenceKey', 'transactionId'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['occurrence']
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
                                                    enum: ['occurrence.reassigned']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        occurrenceKey: {
                                                            bsonType: 'string',
                                                            pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                        },
                                                        transactionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        previousRecurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        previousOccurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        previousOccurrenceKey: {
                                                            bsonType: 'string',
                                                            pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                        }
                                                    },
                                                    required: ['recurrenceId', 'occurrenceKey', 'transactionId', 'previousRecurrenceId', 'previousOccurrenceId', 'previousOccurrenceKey'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['occurrence']
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
                                                    enum: ['occurrence.unlinked']
                                                },
                                                params: {
                                                    bsonType: 'object',
                                                    properties: {
                                                        recurrenceId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        occurrenceKey: {
                                                            bsonType: 'string',
                                                            pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$'
                                                        },
                                                        transactionId: {
                                                            bsonType: 'string',
                                                            pattern: '^[a-f\\d]{24}$'
                                                        },
                                                        choice: {
                                                            bsonType: 'string',
                                                            enum: ['generate', 'release']
                                                        }
                                                    },
                                                    required: ['recurrenceId', 'occurrenceKey', 'transactionId'],
                                                    additionalProperties: false
                                                },
                                                subject: {
                                                    bsonType: ['object'],
                                                    properties: {
                                                        kind: {
                                                            enum: ['occurrence']
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
                                    },
                                    {
                                        code: 'member.updated',
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
                                        code: 'recurrence.created',
                                        $expr: {
                                            $eq: [
                                                {
                                                    $toLower: '$subject.id'
                                                },
                                                {
                                                    $toLower: '$params.recurrenceId'
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        code: 'recurrence.config.updated',
                                        $expr: {
                                            $eq: [
                                                {
                                                    $toLower: '$subject.id'
                                                },
                                                {
                                                    $toLower: '$params.recurrenceId'
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        code: 'recurrence.activated',
                                        $expr: {
                                            $eq: [
                                                {
                                                    $toLower: '$subject.id'
                                                },
                                                {
                                                    $toLower: '$params.recurrenceId'
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        code: 'recurrence.deactivated',
                                        $expr: {
                                            $eq: [
                                                {
                                                    $toLower: '$subject.id'
                                                },
                                                {
                                                    $toLower: '$params.recurrenceId'
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        code: 'recurrence.revision.discarded',
                                        $expr: {
                                            $eq: [
                                                {
                                                    $toLower: '$subject.id'
                                                },
                                                {
                                                    $toLower: '$params.recurrenceId'
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        code: 'recurrence.deleted',
                                        $expr: {
                                            $eq: [
                                                {
                                                    $toLower: '$subject.id'
                                                },
                                                {
                                                    $toLower: '$params.recurrenceId'
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        code: 'occurrence.generated'
                                    },
                                    {
                                        code: 'occurrence.skipped'
                                    },
                                    {
                                        code: 'occurrence.unskipped'
                                    },
                                    {
                                        code: 'occurrence.linked'
                                    },
                                    {
                                        code: 'occurrence.reassigned'
                                    },
                                    {
                                        code: 'occurrence.unlinked'
                                    }
                                ]
                            },
                            {
                                $or: [
                                    {
                                        code: {
                                            $nin: [
                                                'recurrence.created',
                                                'recurrence.config.updated',
                                                'recurrence.activated',
                                                'recurrence.deactivated',
                                                'recurrence.revision.discarded',
                                                'recurrence.deleted',
                                                'occurrence.skipped',
                                                'occurrence.unskipped',
                                                'occurrence.linked',
                                                'occurrence.reassigned',
                                                'occurrence.unlinked'
                                            ]
                                        }
                                    },
                                    {
                                        'actor.kind': 'user'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    },
    indexes: [
        {
            key: {
                accountId: 1,
                date: -1
            },
            background: true
        },
        {
            key: {
                accountId: 1,
                date: -1,
                _id: -1
            },
            name: 'accountId_1_date_-1__id_-1',
            background: true
        }
    ]
};
const codes = [
    'recurrence.created',
    'recurrence.config.updated',
    'recurrence.activated',
    'recurrence.deactivated',
    'recurrence.revision.discarded',
    'recurrence.deleted',
    'occurrence.generated',
    'occurrence.skipped',
    'occurrence.unskipped',
    'occurrence.linked',
    'occurrence.reassigned',
    'occurrence.unlinked'
];
const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => (item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item));
async function matches(context: StructuralContext, schema: CollectionSchema) {
    const info = await context.info(schema.name);
    if (!info || (info.options?.validationLevel && info.options.validationLevel !== 'strict') || (info.options?.validationAction && info.options.validationAction !== 'error')) return false;
    if (canonical(info.options?.validator) !== canonical(schema.validator)) return false;
    const actual = (await context.indexes(schema.name)).map((i) => Object.fromEntries(Object.entries(i).filter(([k]) => k !== 'v')));
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

async function requireSchema(context: StructuralContext, schema: CollectionSchema) {
    if (!(await matches(context, schema))) throw new Error('Unexpected E07 event schema state');
}
function step(id: string, before: CollectionSchema, after: CollectionSchema) {
    return {
        id,
        async inspect(context: StructuralContext) {
            return (await matches(context, before)) ? ('before' as const) : (await matches(context, after)) ? ('after' as const) : ('ambiguous' as const);
        },
        async apply(context: StructuralContext) {
            await context.validator('events', after.validator);
        },
        async verify(context: StructuralContext) {
            await requireSchema(context, after);
        }
    };
}
export const migration: StructuralMigration = {
    type: 'structural',
    predecessor: '20261107182346881-domain-writer-revisions',
    description: 'Add twelve recurrence activity contracts without recurrence domain implementation or backfill',
    namespaces: ['events'],
    schemaChanges: { events: afterEvents },
    async preUp(context) {
        await requireSchema(context, beforeEvents);
        if (await context.count('events', { $nor: [afterEvents.validator] })) throw new Error('Existing events require read-only audit and a separate data decision');
    },
    async preDown(context) {
        await requireSchema(context, afterEvents);
        if (await context.count('events', { schemaVersion: { $exists: true }, code: { $in: codes } })) throw new Error('Down would invalidate retained recurrence activity; use a separately reviewed compatible transition');
        if (await context.count('events', { $nor: [beforeEvents.validator] })) throw new Error('Existing events are incompatible with the predecessor');
    },
    up: [step('expand-recurrence-activity', beforeEvents, afterEvents)],
    down: [step('restore-event-validator', afterEvents, beforeEvents)],
    verifyUp: (context) => requireSchema(context, afterEvents),
    verifyDown: (context) => requireSchema(context, beforeEvents)
};
