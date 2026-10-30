import { addMonthsToMonthKey, currentMonthKey, monthKeyOfUtcDate, monthKeyToAnchor, monthKeyToAnchorIso, normalizeMonthInput, type MonthKey } from '@tobu/contracts/calendar';

/**
 * API month helpers. All calendar rules come from @tobu/contracts/calendar; this module only adapts them to the
 * shapes the routes use (Date anchors, [start, end) ranges, ISO anchors). Everything is UTC.
 */

/** Month key of a Date (floored to its UTC month) or of a MonthInput string (YYYY-MM or exact UTC anchor). */
export function toMonthKey(input: string | Date): MonthKey {
    return typeof input === 'string' ? normalizeMonthInput(input) : monthKeyOfUtcDate(input);
}

/** YYYY-MM / exact UTC anchor / Date -> JS Date on the month anchor (UTC, 1st, 00:00:00.000). Other strings are rejected. */
export function toMonthDate(input: string | Date): Date {
    return monthKeyToAnchor(toMonthKey(input));
}

/** Month anchor as ISO string (YYYY-MM-01T00:00:00.000Z). */
export function toMonthAnchorISO(input: string | Date | number): string {
    return monthKeyToAnchorIso(toMonthKey(typeof input === 'number' ? new Date(input) : input));
}

/** [start, end) of a month: end is the first instant of the next month and is NOT part of the month. */
export function monthRangeFromISO(monthInput: string): { start: Date; end: Date } {
    const key = normalizeMonthInput(monthInput);
    return { start: monthKeyToAnchor(key), end: monthKeyToAnchor(addMonthsToMonthKey(key, 1)) };
}

/** Month anchors (ISO) of the last n months including the reference month, oldest -> newest. */
export function lastNMonthAnchorsISO(n: number, ref: Date): string[] {
    const current = monthKeyOfUtcDate(ref);
    return Array.from({ length: n }, (_, i) => monthKeyToAnchorIso(addMonthsToMonthKey(current, i - (n - 1))));
}

/** Current month of the H08 interim operation: the UTC month. Becomes the account zone in P04. */
export const currentMonthKeyUtc = (now: Date): MonthKey => currentMonthKey('UTC', now);

/**
 * True if a month range [fromMonth, toMonth] (both inclusive month anchors, null = open) contains the month that
 * starts at monthStart. A range starting in a later month is never active, a range ending in an earlier month neither.
 */
export function isActiveInMonth(fromMonth: Date | null | undefined, toMonth: Date | null | undefined, monthStart: Date, monthEnd: Date): boolean {
    return (fromMonth == null || fromMonth < monthEnd) && (toMonth == null || toMonth >= monthStart);
}

/** Mongo filter for the same rule as {@link isActiveInMonth} (fromMonth/toMonth fields, null = open). */
export function activeInMonthFilter(monthStart: Date, monthEnd: Date) {
    return {
        $and: [{ $or: [{ fromMonth: null }, { fromMonth: { $lt: monthEnd } }] }, { $or: [{ toMonth: null }, { toMonth: { $gte: monthStart } }] }]
    };
}
