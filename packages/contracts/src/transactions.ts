import { z } from 'zod';
import { ObjId, MoneyMinor, Month } from './common.js';
import { monthKeyOfUtcDate, monthKeyToAnchor } from './calendar.js';
// ─── shared field definitions ───────────────────────────────────────────────
const TxTitle = z.string().min(2).max(80);
const TxNotes = z.string().max(1000).nullish();
const TxType = z.enum(['income', 'expense']);
const TxStatus = z.enum(['booked', 'pending']);
// ─── helpers ─────────────────────────────────────────────────────────────────
/** Derive the month anchor (YYYY-MM-01T00:00:00.000Z) from an ISO bookDate string (UTC month of the value). */
export function monthFromBookDate(bookDate: string): Date {
    return monthKeyToAnchor(monthKeyOfUtcDate(new Date(bookDate)));
}
/** Derive the month anchor from a YYYY-MM string. */
export function monthFromYYYYMM(ym: string): Date {
    return monthKeyToAnchor(ym);
}
// ─── Create ──────────────────────────────────────────────────────────────────
const CreateTxBase = z
    .object({
        accountId: ObjId,
        categoryId: ObjId.nullish(),
        title: TxTitle,
        notes: TxNotes,
        type: TxType,
        amountMinor: MoneyMinor,
        /** Required when bookDate is absent (i.e. status=pending without bookDate). */
        month: Month.optional(),
        bookDate: z.string().datetime().nullish(),
        status: TxStatus.default('pending'),
        isFromSharedAccount: z.boolean(),
        paidByMemberId: ObjId.nullish(),
        parentTransactionId: ObjId.nullish(),
        recurrenceId: ObjId.nullish()
    })
    .refine((d) => !(d.status === 'booked' && !d.bookDate), { message: 'bookDate is required when status is booked', path: ['bookDate'] })
    .refine((d) => !(d.isFromSharedAccount === false && !d.paidByMemberId), { message: 'paidByMemberId is required when isFromSharedAccount is false', path: ['paidByMemberId'] })
    .refine((d) => !!(d.bookDate || d.month), { message: 'Either bookDate or month must be provided', path: ['month'] });
export const CreateTx = CreateTxBase;
// ─── Patch ────────────────────────────────────────────────────────────────────
// All fields optional; cross-field rules are applied against the MERGED (next) state in the route handler.
export const PatchTx = z.object({
    categoryId: ObjId.nullish(),
    title: TxTitle.optional(),
    notes: TxNotes,
    type: TxType.optional(),
    amountMinor: MoneyMinor.optional(),
    month: Month.optional(),
    bookDate: z.string().datetime().nullish(),
    status: TxStatus.optional(),
    isFromSharedAccount: z.boolean().optional(),
    paidByMemberId: ObjId.nullish(),
    recurrenceId: ObjId.nullish()
});
// ─── Query ────────────────────────────────────────────────────────────────────
const QueryTxBase = z.object({
    accountId: ObjId,
    month: Month.optional(),
    monthFrom: Month.optional(),
    monthTo: Month.optional(),
    status: TxStatus.optional(),
    /** Full-text search on title + notes (Phase 1: parents only). */
    q: z.string().min(1).max(200).optional(),
    /**
     * Filter by parentTransactionId.
     * Pass "null" to list only top-level parents (default behaviour of the list endpoint).
     * Pass an ObjectId to list children of a specific parent (used by autocomplete internally).
     * Omitting this param is equivalent to passing "null".
     */
    parentTransactionId: z.union([ObjId, z.literal('null')]).optional(),
    /**
     * Filter by categoryIds.
     * Array of ObjectIds or the special marker "__UNCATEGORIZED__" to filter for transactions without a category.
     * Can be combined: both uncategorized and specific categories can be selected together.
     */
    categoryIds: z.array(z.union([ObjId, z.literal('__UNCATEGORIZED__')])).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
    sort: z.enum(['bookDateDesc', 'bookDateAsc', 'amountDesc', 'amountAsc']).default('bookDateDesc')
});
export const QueryTx = z.preprocess((input) => {
    if (!input || typeof input !== 'object') return input;
    const data = { ...(input as Record<string, unknown>) };
    if (!('categoryIds' in data) && 'categoryIds[]' in data) data.categoryIds = data['categoryIds[]'];
    if (typeof data.categoryIds === 'string') data.categoryIds = [data.categoryIds];
    delete data['categoryIds[]'];
    return data;
}, QueryTxBase);
export const TransactionSchema = z.object({
    _id: ObjId,
    accountId: ObjId,
    type: TxType,
    amountMinor: MoneyMinor,
    status: TxStatus,
    bookDate: z.string().datetime().nullable(),
    month: z.string().datetime(),
    title: TxTitle,
    notes: z.string().nullable(),
    categoryId: ObjId.nullable(),
    isFromSharedAccount: z.boolean(),
    paidByMemberId: ObjId.nullable(),
    parentTransactionId: ObjId.nullable(),
    recurrenceId: ObjId.nullish(),
    isRecurring: z.boolean().optional()
});
export const TransactionWithChildrenSchema = TransactionSchema.extend({ children: z.array(TransactionSchema) });
// Parent lists embed children; explicit child-list queries return plain transactions.
export const TransactionsPagedResponseSchema = z.object({
    items: z.array(TransactionSchema.extend({ children: z.array(TransactionSchema).optional() })),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(200)
});
export type TransactionModel = z.infer<typeof TransactionSchema>;
export type TransactionWithChildren = z.infer<typeof TransactionWithChildrenSchema>;
export type TransactionsPagedResponse = z.infer<typeof TransactionsPagedResponseSchema>;
export type CreateTransactionDto = z.input<typeof CreateTx>;
export type ValidatedCreateTransaction = z.output<typeof CreateTx>;
export type PatchTransactionDto = z.input<typeof PatchTx>;
export type TransactionType = z.infer<typeof TxType>;
export type TransactionStatus = z.infer<typeof TxStatus>;
export type TransactionSort = z.output<typeof QueryTx>['sort'];
