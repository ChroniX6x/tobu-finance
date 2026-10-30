import { z } from 'zod';

/**
 * Single source of truth for calendar semantics (H01). Pure and framework free.
 *
 * - MonthKey:       business month as "YYYY-MM". Commands and queries use it.
 * - Month anchor:   persisted/response month as an instant at "YYYY-MM-01T00:00:00.000Z".
 * - BankDate:       bank booking day "YYYY-MM-DD". Its JSON/BSON carrier is "YYYY-MM-DDT00:00:00.000Z";
 *                   it is a calendar value, never a real instant, and must not be localized.
 * - Instant:        real timestamps (events, createdAt). Do NOT use the BankDate helpers for them.
 */
export type MonthKey = string;
export type BankDate = string;

const MONTH_KEY = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/;
const BANK_DATE = /^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_ANCHOR = /^[1-9]\d{3}-(0[1-9]|1[0-2])-01T00:00:00\.000Z$/;
const BANK_DATE_CARRIER = /^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T00:00:00\.000Z$/;
const MONTH_INPUT = /^[1-9]\d{3}-(0[1-9]|1[0-2])(-01T00:00:00\.000Z)?$/;

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

export function isMonthKey(value: unknown): value is MonthKey {
    return typeof value === 'string' && MONTH_KEY.test(value);
}

export function isBankDate(value: unknown): value is BankDate {
    if (typeof value !== 'string' || !BANK_DATE.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    return day <= daysInMonth(year, month);
}

export function isMonthAnchor(value: unknown): boolean {
    return typeof value === 'string' && MONTH_ANCHOR.test(value);
}

export function isBankDateCarrier(value: unknown): boolean {
    return typeof value === 'string' && BANK_DATE_CARRIER.test(value) && isBankDate(value.slice(0, 10));
}

function assertMonthKey(key: string): void {
    if (!isMonthKey(key)) throw new RangeError('Invalid MonthKey, expected YYYY-MM');
}

function assertBankDate(date: string): void {
    if (!isBankDate(date)) throw new RangeError('Invalid BankDate, expected an existing calendar day as YYYY-MM-DD');
}

/** "2026-11" -> "2026-11-01T00:00:00.000Z" */
export function monthKeyToAnchorIso(key: MonthKey): string {
    assertMonthKey(key);
    return `${key}-01T00:00:00.000Z`;
}

/** "2026-11" -> Date at 2026-11-01T00:00:00.000Z (the persisted BSON month anchor) */
export function monthKeyToAnchor(key: MonthKey): Date {
    assertMonthKey(key);
    return new Date(monthKeyToAnchorIso(key));
}

/** Strict inverse of {@link monthKeyToAnchor}. Anything but an exact UTC month anchor is rejected, never "fixed". */
export function monthKeyFromAnchor(anchor: Date | string): MonthKey {
    const iso = typeof anchor === 'string' ? anchor : anchor instanceof Date && !Number.isNaN(anchor.getTime()) ? anchor.toISOString() : '';
    if (!isMonthAnchor(iso)) throw new RangeError('Not a canonical UTC month anchor (YYYY-MM-01T00:00:00.000Z)');
    return iso.slice(0, 7);
}

/** UTC year/month of any instant. Only for values that are explicitly defined in UTC, e.g. BankDate carriers. */
export function monthKeyOfUtcDate(date: Date): MonthKey {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
    const year = date.getUTCFullYear();
    if (year < MIN_YEAR || year > MAX_YEAR) throw new RangeError('Year out of supported range');
    return `${String(year)}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Command/query input: a MonthKey or, as transition compatibility, the exact UTC month anchor.
 * Always returns the MonthKey. Other days, times or offsets (e.g. "2026-11-02", "2026-11-01T01:00:00+01:00") are rejected.
 */
export function normalizeMonthInput(input: string): MonthKey {
    if (typeof input !== 'string' || !MONTH_INPUT.test(input)) throw new RangeError('Month must be YYYY-MM or an exact UTC month anchor');
    return input.slice(0, 7);
}

export function addMonthsToMonthKey(key: MonthKey, months: number): MonthKey {
    assertMonthKey(key);
    if (!Number.isInteger(months)) throw new RangeError('months must be an integer');
    const [year, month] = key.split('-').map(Number) as [number, number];
    const total = year * 12 + (month - 1) + months;
    const nextYear = Math.floor(total / 12);
    if (nextYear < MIN_YEAR || nextYear > MAX_YEAR) throw new RangeError('Year out of supported range');
    return `${String(nextYear)}-${String((((total % 12) + 12) % 12) + 1).padStart(2, '0')}`;
}

/** "2026-11-01" -> "2026-11-01T00:00:00.000Z" */
export function bankDateToCarrier(date: BankDate): string {
    assertBankDate(date);
    return `${date}T00:00:00.000Z`;
}

/** Strict inverse of {@link bankDateToCarrier}. Real instants or offsets are rejected, never shifted. */
export function bankDateFromCarrier(carrier: string): BankDate {
    if (!isBankDateCarrier(carrier)) throw new RangeError('Not a BankDate carrier (YYYY-MM-DDT00:00:00.000Z for an existing day)');
    return carrier.slice(0, 10);
}

/** The booking month is the month of the BankDate calendar day, independent of any time zone. */
export function monthKeyFromBankDate(date: BankDate): MonthKey {
    assertBankDate(date);
    return date.slice(0, 7);
}

export function monthKeyFromBankDateCarrier(carrier: string): MonthKey {
    return monthKeyFromBankDate(bankDateFromCarrier(carrier));
}

export function isValidIanaTimeZone(zone: string): boolean {
    // Intl also accepts fixed offsets such as "+01:00"; those are not IANA zones and must never replace DST-aware zones.
    if (typeof zone !== 'string' || !zone.trim() || zone !== zone.trim() || /^[+-]/.test(zone)) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}

/** Current month of an account zone at the given (trusted) instant. Uses the IANA database, never fixed offsets. */
export function currentMonthKey(zone: string, now: Date): MonthKey {
    if (!isValidIanaTimeZone(zone)) throw new RangeError('Invalid IANA time zone');
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new RangeError('Invalid date');
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit' }).formatToParts(now);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    if (!year || !month) throw new RangeError('Could not resolve the current month');
    return `${year.padStart(4, '0')}-${month}`;
}

// ─── Zod schemas (strings stay strings; the helpers above do the conversion) ───────────────────
export const MonthKeySchema = z.string().regex(MONTH_KEY, 'Month must be YYYY-MM');
/** MonthKey or the exact UTC month anchor (transition input). Output stays the original string; use normalizeMonthInput. */
export const MonthInputSchema = z.string().regex(MONTH_INPUT, 'Month must be YYYY-MM or an exact UTC month anchor');
export const CanonicalUtcMonthAnchorSchema = z.string().regex(MONTH_ANCHOR, 'Must be YYYY-MM-01T00:00:00.000Z');
export const BankDateSchema = z.string().regex(BANK_DATE, 'BankDate must be YYYY-MM-DD').refine(isBankDate, 'BankDate must be an existing calendar day');
export const BankDateCarrierSchema = z.string().regex(BANK_DATE_CARRIER, 'BankDate carrier must be YYYY-MM-DDT00:00:00.000Z').refine(isBankDateCarrier, 'BankDate carrier must be an existing calendar day');
