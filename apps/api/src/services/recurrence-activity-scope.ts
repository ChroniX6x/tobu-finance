import mongoose, { Types, type ClientSession } from 'mongoose';
import { z } from 'zod';
import { ObjId } from '@tobu/contracts/common';
import { MonthKeySchema } from '@tobu/contracts/calendar';
import type { ActivityWriteEvent } from '@tobu/contracts/activity';

const Id = ObjId.transform((id) => id.toLowerCase());
const base = { id: Id, accountId: Id };
const RecordSchema = z.discriminatedUnion('kind', [
    z.strictObject({ ...base, kind: z.literal('recurrence') }),
    z.strictObject({ ...base, kind: z.literal('revision'), recurrenceId: Id }),
    z.strictObject({ ...base, kind: z.literal('occurrence'), recurrenceId: Id, occurrenceKey: MonthKeySchema, transactionId: Id.nullable().default(null) })
]);
export type RecurrenceScopeRecord = z.infer<typeof RecordSchema>;
export type RecurrenceScopeKind = RecurrenceScopeRecord['kind'];
export interface RecurrenceScopePort {
    readonly kind: 'recurrence-activity-scope';
}
type Proof = { readonly value: RecurrenceScopeRecord };
type Loader = (request: {
    readonly session: ClientSession;
    readonly kind: RecurrenceScopeKind;
    readonly id: string;
    readonly accountId: string;
    /** Attests only this lookup, not another request, phase or transaction. Query using session before calling. */
    readonly attest: (row: unknown) => Proof;
}) => Promise<Proof | null>;
const ports = new WeakMap<object, Loader>();
export class RecurrenceActivityScopeError extends Error {}
function fail(code: string): never {
    throw new RecurrenceActivityScopeError(code);
}

/** Server-internal port. No registry, collection-name option, HTTP input or production domain implementation. */
export function createRecurrenceActivityScope(loader: Loader): RecurrenceScopePort {
    const port = Object.freeze({ kind: 'recurrence-activity-scope' as const });
    ports.set(port, loader);
    return port;
}
export const isRecurrenceActivityScope = (port: unknown): port is RecurrenceScopePort => !!port && typeof port === 'object' && ports.has(port);

export async function resolveRecurrenceActivityScope(port: RecurrenceScopePort, session: ClientSession, kind: RecurrenceScopeKind, id: string, accountId: string) {
    if (!isRecurrenceActivityScope(port) || !session.inTransaction()) fail('ACTIVITY_E07_SCOPE_CAPABILITY_REQUIRED');
    const transaction = session.transaction;
    const active = () => session.inTransaction() && session.transaction === transaction;
    const proofs = new WeakSet<object>();
    const result = await ports.get(port)!({
        session,
        kind,
        id,
        accountId,
        attest(row) {
            if (!active()) return fail('ACTIVITY_E07_SCOPE_SESSION_REQUIRED');
            const proof = Object.freeze({ value: Object.freeze(RecordSchema.parse(row)) });
            proofs.add(proof);
            return proof;
        }
    });
    if (!active()) fail('ACTIVITY_E07_SCOPE_SESSION_REQUIRED');
    if (result === null) return null;
    if (!proofs.has(result)) fail('ACTIVITY_E07_SCOPE_WITNESS_INVALID');
    const row = result.value;
    if (row.kind !== kind || row.id !== id || row.accountId !== accountId) fail('ACTIVITY_E07_SCOPE_MISMATCH');
    return row;
}

/** Validate identity/relations only; future domain guards still own config, finance, sparse-state and delete eligibility. */
export async function checkRecurrenceActivityScope(port: RecurrenceScopePort, event: ActivityWriteEvent, session: ClientSession, phase: 'before' | 'after') {
    const p = event.params as Record<string, unknown>;
    const recurrenceId = String(p.recurrenceId),
        accountId = event.accountId;
    const load = (kind: RecurrenceScopeKind, id: string) => resolveRecurrenceActivityScope(port, session, kind, id, accountId);
    const parent = await load('recurrence', recurrenceId);
    const absent = (event.code === 'recurrence.created' && phase === 'before') || (event.code === 'recurrence.deleted' && phase === 'after');
    if (absent ? parent !== null : parent === null) fail('ACTIVITY_E07_SUBJECT_PHASE_INVALID');
    for (const key of ['revisionId', 'previousRevisionId', 'restoredRevisionId']) {
        if (!p[key]) continue;
        const revision = await load('revision', String(p[key]));
        if (event.code === 'recurrence.created' && phase === 'before') {
            if (revision) fail('ACTIVITY_E07_REVISION_ALREADY_EXISTS');
            continue;
        }
        const optional = key === 'revisionId' && event.code === 'recurrence.config.updated' && phase === 'before';
        if (!revision) {
            if (optional) continue;
            fail('ACTIVITY_E07_REVISION_UNAVAILABLE');
        }
        if (revision.kind !== 'revision' || revision.recurrenceId !== recurrenceId) fail('ACTIVITY_E07_REVISION_RELATION_INVALID');
    }
    const checkParent = async (id: string, optional = false) => {
        const row = await mongoose.connection.db!.collection('transactions').findOne({ _id: new Types.ObjectId(id), accountId: new Types.ObjectId(accountId), parentTransactionId: null }, { session, projection: { _id: 1 } });
        if (!row && !optional) fail('ACTIVITY_E07_PARENT_UNAVAILABLE');
    };
    if (event.subject.kind !== 'occurrence') return;
    const occurrence = await load('occurrence', event.subject.id);
    const optionalBefore = phase === 'before' && ['occurrence.generated', 'occurrence.skipped', 'occurrence.linked', 'occurrence.reassigned'].includes(event.code);
    const optionalAfter = phase === 'after' && ['occurrence.unskipped', 'occurrence.unlinked'].includes(event.code) && !p.choice;
    if (!occurrence && !optionalBefore && !optionalAfter) fail('ACTIVITY_E07_OCCURRENCE_UNAVAILABLE');
    if (occurrence) {
        if (occurrence.kind !== 'occurrence' || occurrence.recurrenceId !== recurrenceId || occurrence.occurrenceKey !== p.occurrenceKey) fail('ACTIVITY_E07_OCCURRENCE_RELATION_INVALID');
        if (occurrence.transactionId) await checkParent(occurrence.transactionId);
        if (phase === 'after' && ['occurrence.generated', 'occurrence.linked', 'occurrence.reassigned'].includes(event.code) && occurrence.transactionId !== p.transactionId) fail('ACTIVITY_E07_PARENT_RELATION_INVALID');
        if (phase === 'before' && event.code === 'occurrence.unlinked' && occurrence.transactionId !== p.transactionId) fail('ACTIVITY_E07_PARENT_RELATION_INVALID');
        if (phase === 'after' && (event.code === 'occurrence.skipped' || p.choice === 'release') && occurrence.transactionId !== null) fail('ACTIVITY_E07_RELEASE_STILL_LINKED');
        if (phase === 'after' && event.code === 'occurrence.unlinked' && occurrence.transactionId === p.transactionId) fail('ACTIVITY_E07_OLD_PARENT_STILL_LINKED');
    }
    if (p.transactionId) await checkParent(String(p.transactionId), event.code === 'occurrence.generated' && phase === 'before');
    if (event.code === 'occurrence.reassigned') {
        const previousParent = await load('recurrence', String(p.previousRecurrenceId));
        if (!previousParent) fail('ACTIVITY_E07_PREVIOUS_RECURRENCE_UNAVAILABLE');
        const previous = await load('occurrence', String(p.previousOccurrenceId));
        if (!previous && phase === 'before') fail('ACTIVITY_E07_PREVIOUS_OCCURRENCE_UNAVAILABLE');
        if (previous) {
            if (previous.kind !== 'occurrence' || previous.recurrenceId !== p.previousRecurrenceId || previous.occurrenceKey !== p.previousOccurrenceKey) fail('ACTIVITY_E07_PREVIOUS_RELATION_INVALID');
            if (previous.transactionId) await checkParent(previous.transactionId);
            if (phase === 'before' ? previous.transactionId !== p.transactionId : previous.transactionId === p.transactionId) fail('ACTIVITY_E07_REASSIGN_RELATION_INVALID');
        }
    }
}
