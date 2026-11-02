import { DateTime } from 'luxon';
import { isBankDateCarrier, monthKeyOfUtcDate, monthKeyToAnchor } from '@tobu/contracts/calendar';

/**
 * Month/bookDate rules for transaction writes (H02, H08-FIX-CAL).
 *
 * - A bookDate decides the month. A month sent together with a bookDate must agree with it.
 * - A transaction without a bookDate needs an explicit month.
 * - bookDate is written as a BankDate carrier (YYYY-MM-DDT00:00:00.000Z). Transition rule: another instant is accepted
 *   only as an exact echo of the value that is already stored (own row on PATCH, the parent for a split child);
 *   otherwise BOOKDATE_NOT_CARRIER and nothing is written. The month is the UTC month of the stored value.
 *   Historical values are never re-derived or "fixed": an unchanged bookDate or a month equal to the existing one is a no-op.
 */
export type MonthRuleError = 'MONTH_BOOKDATE_MISMATCH' | 'MONTH_REQUIRED' | 'INVALID_BOOKDATE' | 'BOOKDATE_NOT_CARRIER';
export type CreateDates = { bookDate: Date | null; month: Date };
export type PatchDates = { bookDate?: Date | null; month?: Date };
export type Resolved<T> = { ok: true; value: T } | { ok: false; error: MonthRuleError };

const fail = (error: MonthRuleError): { ok: false; error: MonthRuleError } => ({ ok: false, error });

/** Parses an ISO bookDate in UTC (Luxon, explicit zone). Returns null for invalid input. */
function parseBookDate(value: string): Date | null {
    const parsed = DateTime.fromISO(value, { zone: 'utc' });
    return parsed.isValid ? parsed.toJSDate() : null;
}

function keyOfBookDate(bookDate: Date): string | null {
    try {
        return monthKeyOfUtcDate(bookDate);
    } catch {
        return null;
    }
}

export const monthKeyOfStoredMonth = (month: Date): string => monthKeyOfUtcDate(month);

/** `echoOf`: the bookDate already stored by the parent of a split child; the only non-carrier a create may carry. */
export function resolveCreateDates(bookDate: string | null | undefined, month: string | null | undefined, echoOf?: Date | null): Resolved<CreateDates> {
    if (bookDate) {
        const date = parseBookDate(bookDate);
        const key = date && keyOfBookDate(date);
        if (!date || !key) return fail('INVALID_BOOKDATE');
        if (month && month !== key) return fail('MONTH_BOOKDATE_MISMATCH');
        if (!isBankDateCarrier(bookDate) && echoOf?.getTime() !== date.getTime()) return fail('BOOKDATE_NOT_CARRIER');
        return { ok: true, value: { bookDate: date, month: monthKeyToAnchor(key) } };
    }
    if (month) return { ok: true, value: { bookDate: null, month: monthKeyToAnchor(month) } };
    return fail('MONTH_REQUIRED');
}

export function resolvePatchDates(prev: { bookDate: Date | null; month: Date }, b: { bookDate?: string | null; month?: string }): Resolved<PatchDates> {
    if (b.bookDate !== undefined && b.bookDate !== null) {
        const next = parseBookDate(b.bookDate);
        const key = next && keyOfBookDate(next);
        if (!next || !key) return fail('INVALID_BOOKDATE');
        if (b.month !== undefined && b.month !== key) return fail('MONTH_BOOKDATE_MISMATCH');
        if (prev.bookDate && prev.bookDate.getTime() === next.getTime()) return { ok: true, value: {} };
        if (!isBankDateCarrier(b.bookDate)) return fail('BOOKDATE_NOT_CARRIER');
        return { ok: true, value: { bookDate: next, month: monthKeyToAnchor(key) } };
    }
    if (b.bookDate === null) {
        // Clearing the date keeps the old month unless an explicit one is given.
        if (!prev.bookDate && b.month === undefined) return { ok: true, value: {} };
        return { ok: true, value: { bookDate: null, ...(b.month !== undefined ? { month: monthKeyToAnchor(b.month) } : {}) } };
    }
    if (b.month !== undefined) {
        if (prev.bookDate) {
            // A month equal to the stored one is a no-op (also for legacy rows). Otherwise the month follows the date.
            if (b.month === monthKeyOfStoredMonth(prev.month)) return { ok: true, value: {} };
            return keyOfBookDate(prev.bookDate) === b.month ? { ok: true, value: { month: monthKeyToAnchor(b.month) } } : fail('MONTH_BOOKDATE_MISMATCH');
        }
        return { ok: true, value: { month: monthKeyToAnchor(b.month) } };
    }
    return { ok: true, value: {} };
}

/** Children inherit bookDate and month from their parent; any explicit value has to agree. */
export function childDatesAgree(parent: { bookDate: Date | null; month: Date }, dates: { bookDate?: Date | null; month?: Date }): boolean {
    if (dates.month !== undefined && monthKeyOfStoredMonth(dates.month) !== monthKeyOfStoredMonth(parent.month)) return false;
    if (dates.bookDate !== undefined && (dates.bookDate?.getTime() ?? null) !== (parent.bookDate?.getTime() ?? null)) return false;
    return true;
}
