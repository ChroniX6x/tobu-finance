import {
  addMonthsToMonthKey,
  bankDateFromCarrier,
  bankDateToCarrier,
  currentMonthKey,
  isBankDate,
  isMonthKey,
  monthKeyFromBankDate,
  normalizeMonthInput,
  type BankDate,
  type MonthKey,
} from "@tobu/contracts/calendar";
import { DateTime } from "luxon";

/**
 * PrimeNG date pickers work with local JS Dates. These adapters convert between the picker's
 * local calendar components and the canonical contract values (MonthKey, BankDate and its UTC
 * carrier) without going through an instant, so no timezone can shift the day or month.
 */

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

/** Local calendar day of a picker Date as BankDate (YYYY-MM-DD). */
export function bankDateFromPickerDate(date: Date): BankDate {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/** Local calendar day of a picker Date as the canonical API carrier (YYYY-MM-DDT00:00:00.000Z). */
export function bankDateLocalToCarrier(date: Date): string {
  return bankDateToCarrier(bankDateFromPickerDate(date));
}

/** Picker Date (local midnight of the same calendar day) for a BankDate. */
export function pickerDateFromBankDate(date: BankDate): Date {
  if (!isBankDate(date)) throw new Error(`Invalid BankDate: ${date}`);
  const [year, month, day] = date.split("-").map(Number);
  return DateTime.fromObject(
    { year, month, day },
    { zone: "local" },
  ).toJSDate();
}

/**
 * BankDate of a stored value. Canonical carriers map exactly; legacy non-canonical values are only
 * read (UTC calendar day, as the server derives the month) and never rewritten.
 */
export function bankDateOfStoredValue(value: string): BankDate {
  if (value.length === 10) {
    if (!isBankDate(value)) throw new Error(`Invalid BankDate: ${value}`);
    return value;
  }
  try {
    return bankDateFromCarrier(value);
  } catch {
    const day = DateTime.fromISO(value, { zone: "utc" }).toISODate();
    if (!day) throw new Error(`Invalid stored date: ${value}`);
    return day;
  }
}

/** Picker Date for a BankDate or its carrier; the carrier's UTC calendar day is kept. */
export function pickerDateFromBankDateOrCarrier(value: string): Date {
  return pickerDateFromBankDate(bankDateOfStoredValue(value));
}

/** The user's local calendar day "today" as BankDate. */
export function todayBankDate(now: Date = new Date()): BankDate {
  return bankDateFromPickerDate(now);
}

/** Local year/month of a picker Date as MonthKey. */
export function monthKeyFromPickerDate(date: Date): MonthKey {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}`;
}

/** Picker Date (first day of the month, local midnight) for a MonthKey. */
export function pickerDateFromMonthKey(key: MonthKey): Date {
  if (!isMonthKey(key)) throw new Error(`Invalid MonthKey: ${key}`);
  const [year, month] = key.split("-").map(Number);
  return DateTime.fromObject(
    { year, month, day: 1 },
    { zone: "local" },
  ).toJSDate();
}

/** Business month in the interim state (account zones are not implemented yet): UTC month of the clock. */
export function currentUtcMonthKey(now: Date = new Date()): MonthKey {
  return currentMonthKey("UTC", now);
}

/** Accepts a MonthKey or an exact UTC month anchor and returns the MonthKey. */
export function toMonthKey(value: string): MonthKey {
  return normalizeMonthInput(value);
}

export function shiftMonthKey(key: MonthKey, months: number): MonthKey {
  return addMonthsToMonthKey(key, months);
}

export function formatMonthKey(key: MonthKey, pattern = "MMM. yyyy"): string {
  return DateTime.fromISO(`${normalizeMonthInput(key)}-01`, { zone: "utc" })
    .setLocale("de")
    .toFormat(pattern);
}

/** Display of a month value from a ReadModel (MonthKey, month anchor or ISO day); read-only, UTC based. */
export function formatMonthValue(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" },
): string {
  if (!value) return "—";
  const date =
    value.length === 7
      ? DateTime.fromISO(`${value}-01`, { zone: "utc" })
      : DateTime.fromISO(value, { zone: "utc" });
  return date.isValid
    ? new Intl.DateTimeFormat("de-DE", { ...options, timeZone: "UTC" }).format(
        date.toJSDate(),
      )
    : value;
}

/** BankDate or carrier as a calendar day; never localized. */
export function formatBankDate(value: string, pattern = "dd.MM.yyyy"): string {
  const date = bankDateOfStoredValue(value);
  return DateTime.fromISO(date, { zone: "utc" })
    .setLocale("de")
    .toFormat(pattern);
}

export function monthKeyOfBankDate(value: string): MonthKey {
  return monthKeyFromBankDate(bankDateOfStoredValue(value));
}

/** Real instants (createdAt, events) may be shown in the user's zone. */
export function formatInstant(
  iso: string,
  pattern = "dd.MM.yyyy HH:mm",
): string {
  return DateTime.fromISO(iso, { zone: "local" })
    .setLocale("de")
    .toFormat(pattern);
}
