import { z } from 'zod';
import { ObjId, Role } from './common.js';
import { MonthKeySchema } from './calendar.js';

/**
 * Activity (event) platform contract, E01. Normative design: docs/architecture/event-platform-adr.md.
 *
 * - One persisted event (collection `events`, `date` = real UTC instant) and one API projection (`occurredAt`).
 * - There is deliberately NO request schema that creates an event: events are written only by the server-side writer
 *   (E04) from trusted actor/account context. Clients never send actor, trigger, subject or accountId for events.
 * - Money is integer minor units, months are MonthKey, instants are ISO-UTC. Event time never derives a month or BankDate.
 */

export const ACTIVITY_SCHEMA_VERSION = 1;
/** Pseudo code of events that cannot be shown as a known code (legacy or unsupported). Never persisted. */
export const LEGACY_UNKNOWN_CODE = 'legacy.unknown';
/** E07 namespaces; only the explicitly catalogued codes are accepted, never arbitrary suffixes. */
export const ACTIVITY_RESERVED_CODE_PREFIXES = ['recurrence.', 'occurrence.'] as const;

export const ActivitySubjectKinds = ['account', 'member', 'transaction', 'category', 'memberIncome', 'contributionRule', 'categoryBudget', 'carryOver', 'accountBalance', 'legacyRecurrence', 'recurrence', 'occurrence'] as const;
export const ActivitySubjectKindSchema = z.enum(ActivitySubjectKinds);
export type ActivitySubjectKind = z.infer<typeof ActivitySubjectKindSchema>;

const Instant = z.string().datetime();
// BSON instants have millisecond precision. Accept equivalent UTC spellings without rounding finer input.
const FilterInstant = Instant.refine((value) => !/\.\d{4,}Z$/.test(value), 'At most three fractional second digits');
/**
 * Free text in params is clipped, never rejected: the writer (E04) must not roll back a valid business mutation because a
 * title is long or empty. Empty after trim means "omit"; longer text is cut by code points.
 */
export function clipActivityText(value: unknown, max: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? Array.from(trimmed).slice(0, max).join('') : undefined;
}
export const ACTIVITY_TITLE_MAX = 120;
export const ACTIVITY_NAME_MAX = 80;
const Cents = z.number().int().nonnegative();
const CentsAny = z.number().int();
const Title = z.string().min(1).max(ACTIVITY_TITLE_MAX);
const Name = z.string().min(1).max(ACTIVITY_NAME_MAX).nullable();
const TxType = z.enum(['income', 'expense']);
const TxStatus = z.enum(['booked', 'pending']);
const delta = <T extends z.ZodType>(schema: T) => z.strictObject({ from: schema, to: schema });
const fields = <T extends [string, ...string[]]>(values: T) =>
    z
        .array(z.enum(values))
        .min(1)
        .max(values.length)
        .refine((a) => new Set(a).size === a.length, 'changedFields must be unique');

type CatalogEntry = {
    /** Kind of the changed business object. */
    subject: ActivitySubjectKind;
    /** `accountId`: subject.id is the account; a param name: subject.id must equal that param; absent: subject.id is not part of params. */
    subjectId?: 'accountId' | string;
    /** Whitelisted params. Strict: unknown keys are rejected on write. No notes, reasons, e-mails, tokens or full snapshots. */
    params: z.ZodObject;
};

/**
 * The single event catalog. Existing codes keep their persisted param names (legacy events stay readable with the same
 * schema); new codes follow §22.3. E07 defines event primitives, not a recurrence domain or HTTP API.
 */
export const activityCatalog = {
    'transaction.created': { subject: 'transaction', subjectId: 'transactionId', params: z.strictObject({ transactionId: ObjId, type: TxType, amountMinor: Cents, title: Title.optional(), categoryId: ObjId.optional() }) },
    'transaction.splitChildCreated': {
        subject: 'transaction',
        subjectId: 'transactionId',
        params: z.strictObject({ transactionId: ObjId, parentTransactionId: ObjId, type: TxType, amountMinor: Cents, title: Title.optional(), categoryId: ObjId.optional() })
    },
    'transaction.booked': { subject: 'transaction', subjectId: 'transactionId', params: z.strictObject({ transactionId: ObjId, type: TxType, amountMinor: Cents, title: Title.optional() }) },
    'transaction.statusChanged': { subject: 'transaction', subjectId: 'transactionId', params: z.strictObject({ transactionId: ObjId, from: TxStatus, to: TxStatus, title: Title.optional() }) },
    'transaction.updated': {
        subject: 'transaction',
        subjectId: 'transactionId',
        params: z.strictObject({
            transactionId: ObjId,
            changedFields: fields(['title', 'notes', 'amountMinor', 'type', 'categoryId', 'paidByMemberId', 'isFromSharedAccount', 'recurrenceId', 'bookDate', 'month']),
            amountMinor: delta(Cents).optional(),
            categoryId: delta(ObjId.nullable()).optional(),
            title: Title.optional()
        })
    },
    'transaction.deleted': { subject: 'transaction', subjectId: 'transactionId', params: z.strictObject({ transactionId: ObjId, type: TxType, amountMinor: Cents, title: Title.optional(), childCount: z.number().int().nonnegative() }) },
    'transaction.splitChildDeleted': { subject: 'transaction', subjectId: 'transactionId', params: z.strictObject({ transactionId: ObjId, parentTransactionId: ObjId }) },
    'category.created': { subject: 'category', subjectId: 'categoryId', params: z.strictObject({ categoryId: ObjId, name: Name }) },
    'category.updated': { subject: 'category', subjectId: 'categoryId', params: z.strictObject({ categoryId: ObjId, changedFields: fields(['name', 'customSplit']), name: Name.optional() }) },
    'category.deleted': { subject: 'category', subjectId: 'categoryId', params: z.strictObject({ categoryId: ObjId, name: Name }) },
    'account.created': { subject: 'account', subjectId: 'accountId', params: z.strictObject({ currency: z.string().min(1).max(64) }) },
    'account.settings.updated': { subject: 'account', subjectId: 'accountId', params: z.strictObject({ changedFields: fields(['name', 'currency', 'settings']) }) },
    'account.member.added': { subject: 'member', subjectId: 'memberId', params: z.strictObject({ memberId: ObjId, role: Role.optional() }) },
    'account.member.removed': { subject: 'member', subjectId: 'memberId', params: z.strictObject({ memberId: ObjId }) },
    'account.member.roleChanged': { subject: 'member', subjectId: 'memberId', params: z.strictObject({ memberId: ObjId, from: Role, to: Role }) },
    'member.updated': { subject: 'member', subjectId: 'memberId', params: z.strictObject({ memberId: ObjId, changedFields: fields(['name', 'email']) }) },
    'memberIncome.added': { subject: 'memberIncome', params: z.strictObject({ memberId: ObjId, amountMinor: Cents }) },
    'memberIncome.updated': { subject: 'memberIncome', params: z.strictObject({ memberId: ObjId, amountMinor: Cents }) },
    'memberIncome.removed': { subject: 'memberIncome', params: z.strictObject({ memberId: ObjId }) },
    'contributionRule.added': { subject: 'contributionRule', subjectId: 'ruleId', params: z.strictObject({ ruleId: ObjId, ruleType: z.enum(['additional', 'topup']), amountMinor: Cents }) },
    'contributionRule.updated': { subject: 'contributionRule', subjectId: 'ruleId', params: z.strictObject({ ruleId: ObjId, ruleType: z.enum(['additional', 'topup']), amountMinor: Cents }) },
    'contributionRule.removed': { subject: 'contributionRule', subjectId: 'ruleId', params: z.strictObject({ ruleId: ObjId, ruleType: z.enum(['additional', 'topup']) }) },
    'categoryBudget.added': { subject: 'categoryBudget', params: z.strictObject({ categoryId: ObjId, amountMinor: Cents }) },
    'categoryBudget.updated': { subject: 'categoryBudget', params: z.strictObject({ categoryId: ObjId, amountMinor: Cents }) },
    'categoryBudget.removed': { subject: 'categoryBudget', params: z.strictObject({ categoryId: ObjId }) },
    'carryOver.set': { subject: 'carryOver', params: z.strictObject({ memberId: ObjId, month: MonthKeySchema.nullable(), amountMinor: CentsAny }) },
    'carryOver.removed': { subject: 'carryOver', params: z.strictObject({ memberId: ObjId, month: MonthKeySchema.nullable() }) },
    'accountBalance.set': { subject: 'accountBalance', params: z.strictObject({ month: MonthKeySchema.nullable(), closingBalanceMinor: CentsAny }) },
    'accountBalance.removed': { subject: 'accountBalance', params: z.strictObject({ month: MonthKeySchema.nullable() }) },
    // TEMPORARY (owner decision 2026-11-04): only while the old /api/recurrences route exists. Remove with the route or map to recurrence.* (see ADR).
    'legacyRecurrence.created': { subject: 'legacyRecurrence', params: z.strictObject({ title: Title.optional() }) },
    'legacyRecurrence.updated': { subject: 'legacyRecurrence', params: z.strictObject({ title: Title.optional() }) },
    'legacyRecurrence.deleted': { subject: 'legacyRecurrence', params: z.strictObject({ title: Title.optional() }) },
    'recurrence.created': { subject: 'recurrence', subjectId: 'recurrenceId', params: z.strictObject({ recurrenceId: ObjId, revisionId: ObjId, title: Title.optional() }) },
    'recurrence.config.updated': {
        subject: 'recurrence',
        subjectId: 'recurrenceId',
        params: z.strictObject({
            recurrenceId: ObjId,
            revisionId: ObjId,
            previousRevisionId: ObjId.optional(),
            changedFields: fields(['title', 'type', 'expectedAmountMinor', 'categoryId', 'source', 'paidByMemberId', 'startMonth', 'intervalMonths', 'dayOfMonth', 'notes'])
        })
    },
    'recurrence.activated': { subject: 'recurrence', subjectId: 'recurrenceId', params: z.strictObject({ recurrenceId: ObjId }) },
    'recurrence.deactivated': { subject: 'recurrence', subjectId: 'recurrenceId', params: z.strictObject({ recurrenceId: ObjId }) },
    'recurrence.revision.discarded': { subject: 'recurrence', subjectId: 'recurrenceId', params: z.strictObject({ recurrenceId: ObjId, revisionId: ObjId, restoredRevisionId: ObjId.optional() }) },
    'recurrence.deleted': { subject: 'recurrence', subjectId: 'recurrenceId', params: z.strictObject({ recurrenceId: ObjId }) },
    'occurrence.generated': { subject: 'occurrence', params: z.strictObject({ recurrenceId: ObjId, revisionId: ObjId, occurrenceKey: MonthKeySchema, transactionId: ObjId }) },
    'occurrence.skipped': { subject: 'occurrence', params: z.strictObject({ recurrenceId: ObjId, occurrenceKey: MonthKeySchema }) },
    'occurrence.unskipped': { subject: 'occurrence', params: z.strictObject({ recurrenceId: ObjId, occurrenceKey: MonthKeySchema, choice: z.enum(['generate', 'release']).optional() }) },
    'occurrence.linked': { subject: 'occurrence', params: z.strictObject({ recurrenceId: ObjId, occurrenceKey: MonthKeySchema, transactionId: ObjId }) },
    'occurrence.reassigned': {
        subject: 'occurrence',
        params: z.strictObject({ recurrenceId: ObjId, occurrenceKey: MonthKeySchema, transactionId: ObjId, previousRecurrenceId: ObjId, previousOccurrenceId: ObjId, previousOccurrenceKey: MonthKeySchema })
    },
    'occurrence.unlinked': { subject: 'occurrence', params: z.strictObject({ recurrenceId: ObjId, occurrenceKey: MonthKeySchema, transactionId: ObjId, choice: z.enum(['generate', 'release']).optional() }) }
} as const satisfies Record<string, CatalogEntry>;

export type ActivityCode = keyof typeof activityCatalog;
export const RECURRENCE_ACTIVITY_CODES = [
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
] as const satisfies readonly ActivityCode[];
export type RecurrenceActivityCode = (typeof RECURRENCE_ACTIVITY_CODES)[number];
export const isRecurrenceActivityCode = (code: string): code is RecurrenceActivityCode => (RECURRENCE_ACTIVITY_CODES as readonly string[]).includes(code);
export type ActivityParams<C extends ActivityCode> = z.infer<(typeof activityCatalog)[C]['params']>;
export const ACTIVITY_CODES = Object.keys(activityCatalog) as ActivityCode[];
export const ActivityCodeSchema = z.enum(ACTIVITY_CODES as [ActivityCode, ...ActivityCode[]]);
/** Codes that existed before E01 (persisted without actor). Only they can appear as legacy events. */
export const LEGACY_ACTIVITY_CODES = [
    'transaction.created',
    'transaction.splitChildCreated',
    'transaction.booked',
    'transaction.statusChanged',
    'transaction.splitChildDeleted',
    'account.member.added',
    'account.member.removed',
    'memberIncome.added',
    'memberIncome.updated',
    'memberIncome.removed',
    'contributionRule.added',
    'contributionRule.updated',
    'contributionRule.removed',
    'categoryBudget.added',
    'categoryBudget.updated',
    'categoryBudget.removed'
] as const satisfies readonly ActivityCode[];

export const isReservedActivityCode = (code: string): boolean => ACTIVITY_RESERVED_CODE_PREFIXES.some((prefix) => code.startsWith(prefix)) && !Object.prototype.hasOwnProperty.call(activityCatalog, code);
export const isActivityCode = (code: unknown): code is ActivityCode => typeof code === 'string' && Object.prototype.hasOwnProperty.call(activityCatalog, code);

/** Cases that must NEVER produce an event (A-E01 no-event list). Each is a test obligation of E04/E05. */
export const ACTIVITY_NO_EVENT_CASES = [
    'GET/read, list, overview, month-view, planning, master-data and activity requests',
    'previews, drafts, UI navigation and client-side filtering',
    'rejected requests (400, 401, 403, 404, 409, 422) and validation errors',
    'rolled-back or failed transactions (domain and event commit together or not at all)',
    'no-op writes (nothing persisted changes, including an equal value PATCH or equal upsert)',
    'retry or replay of an already committed command (same stable key)',
    'derived recalculations without an own business write (e.g. regenerated base rules are covered by the budget event)',
    'user-scoped master data that is not account-scoped (Member CRUD); account membership changes use account.member.*',
    'authentication and session handling (register, login, refresh, logout)'
] as const;

// ---------------------------------------------------------------------------------------------------------------
// Persisted form (what the server-side writer inserts for NEW events)
// ---------------------------------------------------------------------------------------------------------------

export const ActivityActorWriteSchema = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('user'), userId: ObjId }), z.strictObject({ kind: z.literal('system') })]);
export const ActivityTriggerKinds = ['user_action', 'account_open', 'automation', 'system_reconciliation'] as const;
export const ActivityTriggerWriteSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('user_action') }),
    z.strictObject({ kind: z.enum(['account_open', 'automation', 'system_reconciliation']), initiatedByUserId: ObjId.optional() })
]);
export const ActivitySubjectSchema = z.strictObject({ kind: ActivitySubjectKindSchema, id: ObjId });
/** Stable key of one logical command / request correlation / trusted batch. Server generated, never client supplied. */
export const ActivityKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/, 'Key must be 8-64 characters of [A-Za-z0-9._:-]');

const writeBase = {
    accountId: ObjId,
    date: z.union([z.date(), Instant]),
    schemaVersion: z.literal(ACTIVITY_SCHEMA_VERSION),
    actor: ActivityActorWriteSchema,
    trigger: ActivityTriggerWriteSchema,
    subject: ActivitySubjectSchema,
    commandId: ActivityKeySchema.optional(),
    correlationId: ActivityKeySchema.optional(),
    batchId: ActivityKeySchema.optional(),
    /** Legacy column. New events never fill it with an actor; absent or null only. */
    createdByMemberId: z.null().optional()
};

type WriteBase = z.infer<z.ZodObject<typeof writeBase>>;
export type ActivityWriteEvent = { [C in ActivityCode]: WriteBase & { code: C; params: ActivityParams<C> } }[ActivityCode];

const writeVariants = ACTIVITY_CODES.map((code) => z.strictObject({ ...writeBase, code: z.literal(code), params: activityCatalog[code].params }));

export const ActivityWriteEventSchema = (z.discriminatedUnion('code', writeVariants as unknown as [(typeof writeVariants)[number], ...(typeof writeVariants)[number][]]) as unknown as z.ZodType<ActivityWriteEvent>).superRefine((event, ctx) => {
    const entry: CatalogEntry = activityCatalog[event.code];
    const actorIsUser = event.actor.kind === 'user';
    const triggerIsUser = event.trigger.kind === 'user_action';
    if (actorIsUser !== triggerIsUser) ctx.addIssue({ code: 'custom', path: ['trigger'], message: 'actor user requires trigger user_action; actor system requires an internal trigger' });
    if (isRecurrenceActivityCode(event.code) && event.code !== 'occurrence.generated' && !actorIsUser) ctx.addIssue({ code: 'custom', path: ['actor'], message: 'This recurrence action requires a verified user actor' });
    if (actorIsUser && 'initiatedByUserId' in event.trigger) ctx.addIssue({ code: 'custom', path: ['trigger', 'initiatedByUserId'], message: 'initiatedByUserId is only allowed for system actors' });
    if (event.subject.kind !== entry.subject) ctx.addIssue({ code: 'custom', path: ['subject', 'kind'], message: `subject.kind must be ${entry.subject} for ${event.code}` });
    if (entry.subjectId) {
        const expected = entry.subjectId === 'accountId' ? event.accountId : (event.params as Record<string, unknown>)[entry.subjectId];
        if (String(expected).toLowerCase() !== event.subject.id.toLowerCase()) ctx.addIssue({ code: 'custom', path: ['subject', 'id'], message: `subject.id must equal ${entry.subjectId}` });
    }
});

// ---------------------------------------------------------------------------------------------------------------
// Read projection (API, E06). Never exposes user ids, command ids or raw legacy columns.
// ---------------------------------------------------------------------------------------------------------------

const MemberRef = z.strictObject({ memberId: ObjId.nullable(), displayName: z.string().max(120).nullable() });
/** USER = real authenticated person (memberId only when linked and visible), SYSTEM = server automation, UNKNOWN = legacy/unsupported, never a guessed person. */
export const ActivityActorViewSchema = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('user'), ...MemberRef.shape }), z.strictObject({ kind: z.literal('system') }), z.strictObject({ kind: z.literal('unknown') })]);
export const ActivityTriggerViewSchema = z.strictObject({ kind: z.enum([...ActivityTriggerKinds, 'unknown']), initiatedBy: MemberRef.optional() });
/** `deleted` is computed by the server at read time; the UI links a subject only when `deleted` is false. */
export const ActivitySubjectViewSchema = z.strictObject({ kind: ActivitySubjectKindSchema, id: ObjId, deleted: z.boolean(), label: z.string().max(120).optional() }).nullable();

const itemBase = {
    id: ObjId,
    accountId: ObjId,
    occurredAt: Instant,
    /** 0 = legacy (no actor persisted), 1 = ADR schema. */
    schemaVersion: z.number().int().min(0),
    actor: ActivityActorViewSchema,
    trigger: ActivityTriggerViewSchema,
    subject: ActivitySubjectViewSchema,
    /** Read-only privacy fallback: no reference ids or params when their account binding cannot be verified. */
    detailsUnavailable: z.literal(true).optional(),
    /** Only loaded events may be counted. No completion, planned-total or successful-batch claim. */
    group: z.strictObject({ key: z.string().regex(/^[a-f\d]{64}$/), source: z.enum(['batch', 'command']), scope: z.literal('loaded_only') }).optional(),
    correlationId: ActivityKeySchema.optional(),
    batchId: ActivityKeySchema.optional()
};
const unknownVariant = z.strictObject({
    ...itemBase,
    code: z.literal(LEGACY_UNKNOWN_CODE),
    params: z.strictObject({
        typeHint: z
            .string()
            .regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/)
            .optional()
    })
});
const itemVariants = ACTIVITY_CODES.map((code) => z.strictObject({ ...itemBase, code: z.literal(code), params: activityCatalog[code].params.nullable() }));
type ItemBase = z.infer<z.ZodObject<typeof itemBase>>;
export type ActivityItem = { [C in ActivityCode]: ItemBase & { code: C; params: ActivityParams<C> | null } }[ActivityCode] | (ItemBase & { code: typeof LEGACY_UNKNOWN_CODE; params: { typeHint?: string } });
export const ActivityItemSchema = z.discriminatedUnion('code', [...itemVariants, unknownVariant] as unknown as [typeof unknownVariant, ...(typeof unknownVariant)[]]).superRefine((item, ctx) => {
    if ((item.params === null) !== (item.detailsUnavailable === true)) ctx.addIssue({ code: 'custom', message: 'Unavailable details require null params, and vice versa' });
    if (item.detailsUnavailable && item.subject !== null) ctx.addIssue({ code: 'custom', message: 'Unavailable details cannot expose subject ids' });
    if (item.schemaVersion !== 1 && (item.group || item.batchId || item.correlationId)) ctx.addIssue({ code: 'custom', message: 'Only validated current events may carry grouping keys' });
    if (isRecurrenceActivityCode(item.code) && (item.schemaVersion !== 1 || item.actor.kind === 'unknown' || (item.actor.kind === 'system' && item.code !== 'occurrence.generated')))
        ctx.addIssue({ code: 'custom', message: 'E07 read actors must satisfy the current emit matrix' });
}) as unknown as z.ZodType<ActivityItem>;
export type ActivityActorView = z.infer<typeof ActivityActorViewSchema>;

export const ActivityPageSchema = z.strictObject({ items: z.array(ActivityItemSchema).max(100), nextCursor: z.string().min(1).max(512).nullable() });
export type ActivityPage = z.infer<typeof ActivityPageSchema>;

/** Query of the future `GET /api/accounts/:accountId/activity` (E06). Ordering is fixed: occurredAt desc, id desc. */
export const ActivityQuerySchema = z
    .strictObject({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        cursor: z.string().min(1).max(512).optional(),
        code: z.union([ActivityCodeSchema, z.literal(LEGACY_UNKNOWN_CODE)]).optional(),
        subjectKind: ActivitySubjectKindSchema.optional(),
        subjectId: ObjId.optional(),
        actorKind: z.enum(['user', 'system', 'unknown']).optional(),
        from: FilterInstant.optional(),
        to: FilterInstant.optional()
    })
    .refine((query) => !query.from || !query.to || Date.parse(query.from) < Date.parse(query.to), { message: 'from must be before to', path: ['to'] });
/** Context carried inside the opaque cursor; a cursor of another account or filter set must be rejected with 422 (E06). */
export const ActivityCursorPayloadSchema = z.strictObject({ v: z.literal(1), accountId: ObjId, date: Instant, id: ObjId, filter: z.string().min(1).max(64) });

// ---------------------------------------------------------------------------------------------------------------
// Legacy-compatible decoder (persisted document -> read projection). Pure; never throws, never invents an actor.
// ---------------------------------------------------------------------------------------------------------------

/** Safe default for `subject.deleted`: the event itself removed the subject. E06 recomputes it from the live data at read time. */
const subjectGoneWith = (code: ActivityCode): boolean => /\.(deleted|removed)$|Deleted$/.test(code);

export type DecodedActivity = { ok: true; item: ActivityItem; refs: { actorUserId?: string; initiatedByUserId?: string } } | { ok: false; reason: 'not_an_object' | 'invalid_id' | 'invalid_account' | 'invalid_date' | 'undecodable' };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

/** ObjectId-like values (toHexString) become hex strings; plain objects/arrays are normalized recursively. */
function normalize(value: unknown): unknown {
    if (value instanceof Date || value === null || typeof value !== 'object') return value;
    const hex = (value as { toHexString?: unknown }).toHexString;
    if (typeof hex === 'function') return String((hex as () => string).call(value));
    if (Array.isArray(value)) return value.map(normalize);
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]));
}

function instantOf(value: unknown): string | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (typeof value !== 'string' || !Instant.safeParse(value).success) return null;
    return new Date(value).toISOString();
}

const typeHintOf = (code: unknown): string | undefined => {
    const head = typeof code === 'string' ? (code.split('.')[0] ?? '') : '';
    return /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(head) ? head : undefined;
};

/** Keeps only fields that are valid on their own, then requires the complete params schema; otherwise undefined. */
function projectLegacyParams(code: ActivityCode, raw: unknown): Record<string, unknown> | undefined {
    if (!isRecord(raw)) return undefined;
    const shape = activityCatalog[code].params.shape as Record<string, z.ZodType>;
    const kept: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(shape)) {
        const parsed = schema.safeParse(raw[key]);
        if (parsed.success && parsed.data !== undefined) kept[key] = parsed.data;
    }
    const whole = activityCatalog[code].params.safeParse(kept);
    return whole.success ? (whole.data as Record<string, unknown>) : undefined;
}

export function decodeStoredEvent(doc: unknown): DecodedActivity {
    try {
        return decodeUnsafe(doc);
    } catch {
        return { ok: false, reason: 'undecodable' };
    }
}

function decodeUnsafe(doc: unknown): DecodedActivity {
    if (!isRecord(doc)) return { ok: false, reason: 'not_an_object' };
    const raw = normalize(doc) as Record<string, unknown>;
    if (!ObjId.safeParse(raw._id).success) return { ok: false, reason: 'invalid_id' };
    if (!ObjId.safeParse(raw.accountId).success) return { ok: false, reason: 'invalid_account' };
    const occurredAt = instantOf(raw.date);
    if (occurredAt === null) return { ok: false, reason: 'invalid_date' };
    const base = { id: raw._id as string, accountId: raw.accountId as string, occurredAt };
    const unknownItem = (schemaVersion: number): DecodedActivity => {
        const typeHint = typeHintOf(raw.code);
        return { ok: true, refs: {}, item: { ...base, schemaVersion, code: LEGACY_UNKNOWN_CODE, actor: { kind: 'unknown' }, trigger: { kind: 'unknown' }, subject: null, params: typeHint ? { typeHint } : {} } };
    };

    if (raw.schemaVersion !== undefined) {
        // Anything that claims the ADR schema must satisfy it completely; otherwise it is shown as unknown, never as a guessed actor.
        if (raw.schemaVersion !== ACTIVITY_SCHEMA_VERSION) return unknownItem(0);
        const candidate = {
            accountId: raw.accountId,
            date: new Date(occurredAt),
            schemaVersion: raw.schemaVersion,
            code: raw.code,
            params: raw.params,
            actor: raw.actor,
            trigger: raw.trigger,
            subject: raw.subject,
            commandId: raw.commandId,
            correlationId: raw.correlationId,
            batchId: raw.batchId,
            createdByMemberId: raw.createdByMemberId
        };
        const parsed = ActivityWriteEventSchema.safeParse(Object.fromEntries(Object.entries(candidate).filter(([, value]) => value !== undefined)));
        if (!parsed.success) return unknownItem(0);
        const event = parsed.data;
        const refs: { actorUserId?: string; initiatedByUserId?: string } = {};
        if (event.actor.kind === 'user') refs.actorUserId = event.actor.userId;
        if ('initiatedByUserId' in event.trigger && event.trigger.initiatedByUserId) refs.initiatedByUserId = event.trigger.initiatedByUserId;
        const item = {
            ...base,
            schemaVersion: ACTIVITY_SCHEMA_VERSION,
            code: event.code,
            params: event.params,
            actor: event.actor.kind === 'user' ? { kind: 'user' as const, memberId: null, displayName: null } : { kind: 'system' as const },
            trigger: { kind: event.trigger.kind },
            subject: { kind: event.subject.kind, id: event.subject.id, deleted: subjectGoneWith(event.code) },
            ...(event.correlationId ? { correlationId: event.correlationId } : {}),
            ...(event.batchId ? { batchId: event.batchId } : {})
        } as ActivityItem;
        return { ok: true, item, refs };
    }

    // Legacy: no actor was ever persisted. createdByMemberId meant payer/affected member and is NOT an actor.
    const code = raw.code;
    if (!isActivityCode(code) || !(LEGACY_ACTIVITY_CODES as readonly string[]).includes(code)) return unknownItem(0);
    const params = projectLegacyParams(code, raw.params);
    if (!params) return unknownItem(0);
    const entry: CatalogEntry = activityCatalog[code];
    const subjectId = entry.subjectId && entry.subjectId !== 'accountId' ? params[entry.subjectId] : undefined;
    const subject = typeof subjectId === 'string' ? { kind: entry.subject, id: subjectId, deleted: subjectGoneWith(code) } : null;
    return { ok: true, refs: {}, item: { ...base, schemaVersion: 0, code, params, actor: { kind: 'unknown' }, trigger: { kind: 'unknown' }, subject } as ActivityItem };
}

// ---------------------------------------------------------------------------------------------------------------
// Renderer (German labels). Pure, escapes nothing: UIs must bind the result as text, never as HTML.
// ---------------------------------------------------------------------------------------------------------------

/** Formats integer minor units, e.g. 123456 -> "1.234,56 €". No locale APIs. */
export function formatMinor(minor: number): string {
    const negative = minor < 0;
    const abs = Math.abs(Math.trunc(minor));
    const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${negative ? '-' : ''}${whole},${String(abs % 100).padStart(2, '0')} €`;
}
const withTitle = (title?: string) => (title ? ` (${title})` : '');
const typeLabel = (type: 'income' | 'expense') => (type === 'income' ? 'Einnahme' : 'Ausgabe');
const statusLabel = (status: 'booked' | 'pending') => (status === 'booked' ? 'gebucht' : 'offen');
const roleLabel = (role: 'owner' | 'member') => (role === 'owner' ? 'Owner' : 'Mitglied');
const ruleLabel = (type: 'additional' | 'topup') => (type === 'additional' ? 'zusätzlich' : 'Auffüllung');
const monthLabel = (month: string | null) => (month ? ` ${month}` : '');

/** Completeness is enforced by the mapped type: a new catalog code without a label does not compile. */
export const activityLabels: { [C in ActivityCode]: (params: ActivityParams<C>) => string } = {
    'transaction.created': (p) => `Angelegt: ${typeLabel(p.type)} ${formatMinor(p.amountMinor)}${withTitle(p.title)}`,
    'transaction.splitChildCreated': (p) => `Split-Teil angelegt: ${typeLabel(p.type)} ${formatMinor(p.amountMinor)}${withTitle(p.title)}`,
    'transaction.booked': (p) => `Gebucht: ${typeLabel(p.type)} ${formatMinor(p.amountMinor)}${withTitle(p.title)}`,
    'transaction.statusChanged': (p) => `Transaktion Status: ${statusLabel(p.from)} → ${statusLabel(p.to)}${withTitle(p.title)}`,
    'transaction.updated': (p) => `Transaktion geändert (${p.changedFields.length} ${p.changedFields.length === 1 ? 'Feld' : 'Felder'})${withTitle(p.title)}`,
    'transaction.deleted': (p) => `Transaktion gelöscht: ${typeLabel(p.type)} ${formatMinor(p.amountMinor)}${withTitle(p.title)}${p.childCount > 0 ? `, ${p.childCount} Split-Teile` : ''}`,
    'transaction.splitChildDeleted': () => 'Split-Teil gelöscht',
    'category.created': (p) => `Kategorie angelegt${withTitle(p.name ?? undefined)}`,
    'category.updated': (p) => `Kategorie geändert${withTitle(p.name ?? undefined)}`,
    'category.deleted': (p) => `Kategorie gelöscht${withTitle(p.name ?? undefined)}`,
    'account.created': () => 'Konto angelegt',
    'account.settings.updated': () => 'Kontoeinstellungen geändert',
    'account.member.added': () => 'Mitglied hinzugefügt',
    'account.member.removed': () => 'Mitglied entfernt',
    'account.member.roleChanged': (p) => `Rolle geändert: ${roleLabel(p.from)} → ${roleLabel(p.to)}`,
    'member.updated': () => 'Mitgliedsdaten geändert',
    'memberIncome.added': (p) => `Einkommen hinzugefügt (${formatMinor(p.amountMinor)})`,
    'memberIncome.updated': (p) => `Einkommen aktualisiert (${formatMinor(p.amountMinor)})`,
    'memberIncome.removed': () => 'Einkommen entfernt',
    'contributionRule.added': (p) => `Beitragsregel hinzugefügt (${ruleLabel(p.ruleType)}, ${formatMinor(p.amountMinor)})`,
    'contributionRule.updated': (p) => `Beitragsregel aktualisiert (${ruleLabel(p.ruleType)}, ${formatMinor(p.amountMinor)})`,
    'contributionRule.removed': (p) => `Beitragsregel entfernt (${ruleLabel(p.ruleType)})`,
    'categoryBudget.added': (p) => `Kategorie-Budget gesetzt (${formatMinor(p.amountMinor)})`,
    'categoryBudget.updated': (p) => `Kategorie-Budget aktualisiert (${formatMinor(p.amountMinor)})`,
    'categoryBudget.removed': () => 'Kategorie-Budget entfernt',
    'carryOver.set': (p) => `Übertrag gesetzt${monthLabel(p.month)} (${formatMinor(p.amountMinor)})`,
    'carryOver.removed': (p) => `Übertrag entfernt${monthLabel(p.month)}`,
    'accountBalance.set': (p) => `Kontostand gesetzt${monthLabel(p.month)} (${formatMinor(p.closingBalanceMinor)})`,
    'accountBalance.removed': (p) => `Kontostand entfernt${monthLabel(p.month)}`,
    'legacyRecurrence.created': (p) => `Wiederkehrende Buchung angelegt${withTitle(p.title)}`,
    'legacyRecurrence.updated': (p) => `Wiederkehrende Buchung geändert${withTitle(p.title)}`,
    'legacyRecurrence.deleted': (p) => `Wiederkehrende Buchung gelöscht${withTitle(p.title)}`,
    'recurrence.created': (p) => `Buchungsvorlage angelegt${withTitle(p.title)}`,
    'recurrence.config.updated': (p) => `Vorlagenkonfiguration geändert (${p.changedFields.length} Felder)`,
    'recurrence.activated': () => 'Buchungsvorlage aktiviert',
    'recurrence.deactivated': () => 'Buchungsvorlage deaktiviert',
    'recurrence.revision.discarded': () => 'Vorlagenrevision verworfen',
    'recurrence.deleted': () => 'Buchungsvorlage gelöscht',
    'occurrence.generated': (p) => `Vorlagenvorkommen erzeugt (${p.occurrenceKey})`,
    'occurrence.skipped': (p) => `Vorlagenvorkommen übersprungen (${p.occurrenceKey})`,
    'occurrence.unskipped': (p) => `Überspringen aufgehoben (${p.occurrenceKey})${p.choice === 'release' ? ' – ohne Buchung freigegeben' : ''}`,
    'occurrence.linked': (p) => `Buchung zugeordnet (${p.occurrenceKey})`,
    'occurrence.reassigned': (p) => `Buchung neu zugeordnet (${p.occurrenceKey})`,
    'occurrence.unlinked': (p) => `Buchungszuordnung gelöst (${p.occurrenceKey})${p.choice === 'release' ? ' – ohne Buchung freigegeben' : ''}`
};

/** Human-readable filter labels, checked exhaustively against the current catalog. */
export const activityCodeNames: Record<ActivityCode, string> = {
    'transaction.created': 'Buchung angelegt',
    'transaction.updated': 'Buchung geändert',
    'transaction.deleted': 'Buchung gelöscht',
    'transaction.booked': 'Buchung bestätigt',
    'transaction.statusChanged': 'Buchungsstatus geändert',
    'transaction.splitChildCreated': 'Split-Teil angelegt',
    'transaction.splitChildDeleted': 'Split-Teil gelöscht',
    'category.created': 'Kategorie angelegt',
    'category.updated': 'Kategorie geändert',
    'category.deleted': 'Kategorie gelöscht',
    'account.created': 'Konto angelegt',
    'account.settings.updated': 'Kontoeinstellungen geändert',
    'account.member.added': 'Mitglied hinzugefügt',
    'account.member.removed': 'Mitglied entfernt',
    'account.member.roleChanged': 'Mitgliederrolle geändert',
    'member.updated': 'Mitgliedsdaten geändert',
    'memberIncome.added': 'Einkommen angelegt',
    'memberIncome.updated': 'Einkommen geändert',
    'memberIncome.removed': 'Einkommen entfernt',
    'contributionRule.added': 'Beitragsregel angelegt',
    'contributionRule.updated': 'Beitragsregel geändert',
    'contributionRule.removed': 'Beitragsregel entfernt',
    'categoryBudget.added': 'Budget angelegt',
    'categoryBudget.updated': 'Budget geändert',
    'categoryBudget.removed': 'Budget entfernt',
    'carryOver.set': 'Übertrag gesetzt',
    'carryOver.removed': 'Übertrag entfernt',
    'accountBalance.set': 'Kontostand gesetzt',
    'accountBalance.removed': 'Kontostand entfernt',
    'legacyRecurrence.created': 'Wiederkehrende Buchung angelegt',
    'legacyRecurrence.updated': 'Wiederkehrende Buchung geändert',
    'legacyRecurrence.deleted': 'Wiederkehrende Buchung gelöscht',
    'recurrence.created': 'Buchungsvorlage angelegt',
    'recurrence.config.updated': 'Vorlagenkonfiguration geändert',
    'recurrence.activated': 'Buchungsvorlage aktiviert',
    'recurrence.deactivated': 'Buchungsvorlage deaktiviert',
    'recurrence.revision.discarded': 'Vorlagenrevision verworfen',
    'recurrence.deleted': 'Buchungsvorlage gelöscht',
    'occurrence.generated': 'Vorlagenvorkommen erzeugt',
    'occurrence.skipped': 'Vorlagenvorkommen übersprungen',
    'occurrence.unskipped': 'Überspringen aufgehoben',
    'occurrence.linked': 'Buchung zugeordnet',
    'occurrence.reassigned': 'Buchung neu zugeordnet',
    'occurrence.unlinked': 'Buchungszuordnung gelöst'
};

export function renderActivityText(item: { code: string; params: unknown; detailsUnavailable?: true | undefined }): string {
    if (isActivityCode(item.code) && item.params === null && item.detailsUnavailable) return `${activityCodeNames[item.code]} – Details nicht verfügbar`;
    if (!isActivityCode(item.code)) {
        const typeHint = (item.params as { typeHint?: unknown } | null)?.typeHint;
        return typeof typeHint === 'string' && typeHint ? `Aktivität (${typeHint})` : 'Aktivität';
    }
    try {
        return (activityLabels[item.code] as (params: unknown) => string)(item.params);
    } catch {
        return 'Aktivität';
    }
}

export const ACTIVITY_ACTOR_LABELS_DE = { system: 'System', unknown: 'Unbekannt (Altbestand)', userFallback: 'Benutzer' } as const;
export function renderActivityActor(actor: ActivityActorView): string {
    if (actor.kind === 'system') return ACTIVITY_ACTOR_LABELS_DE.system;
    if (actor.kind === 'unknown') return ACTIVITY_ACTOR_LABELS_DE.unknown;
    return actor.displayName ?? ACTIVITY_ACTOR_LABELS_DE.userFallback;
}
export const ACTIVITY_TRIGGER_LABELS_DE = { user_action: 'Benutzeraktion', account_open: 'Beim Öffnen des Kontos', automation: 'Automatik', system_reconciliation: 'Systemabgleich', unknown: 'Unbekannt' } as const;

/** Schemas published in OpenAPI components before the route exists (route and endpoint registration follow in E06). */
export const activityOpenApiSchemas = { ActivityItem: ActivityItemSchema, ActivityPage: ActivityPageSchema, ActivityQuery: ActivityQuerySchema } as const;
