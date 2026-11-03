/**
 * H08-NACHTRAG-TESTS (EX-01, CAL-06): the picker adapter (calendar-picker.ts) in real browser zones.
 *
 * The real adapter source is bundled with esbuild and executed in a Chromium context whose zone is set by
 * Playwright's `timezoneId`; no date function is mocked and no clock is faked. Expected values come from
 * Luxon in the test process with the same explicit zone, independent of the code under test.
 */
import { build } from "esbuild";
import { resolve } from "node:path";
import { DateTime } from "luxon";
import { expect, test } from "./helpers/test-fixture";

const ZONES = [
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "UTC",
  // DST starts at local midnight here, so local 00:00 of the switch day does not exist
  "America/Havana",
  "Pacific/Kiritimati",
  "Pacific/Pago_Pago",
] as const;

const DAYS = [
  "2025-12-31",
  "2026-01-01",
  "2026-02-28",
  "2026-03-01",
  "2026-03-08", // DST start New York, Havana
  "2026-03-29", // DST start Berlin
  "2026-10-25", // DST end Berlin
  "2026-10-31",
  "2026-11-01", // DST end New York
  "2026-12-31",
  "2027-01-01",
  "2027-02-28",
  "2028-02-28",
  "2028-02-29",
  "2028-03-01",
];

const MONTHS = [
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-10",
  "2026-11",
  "2026-12",
  "2027-01",
  "2028-02",
  "2028-03",
];

// Instants around the DST switches and the month/year/leap boundaries (UTC)
const INSTANTS = [
  "2026-03-08T04:59:59.999Z",
  "2026-03-08T05:00:00.000Z",
  "2026-03-28T23:30:00.000Z",
  "2026-03-29T00:59:59.999Z",
  "2026-03-29T01:00:00.000Z",
  "2026-10-24T22:30:00.000Z",
  "2026-10-31T23:30:00.000Z",
  "2026-11-01T05:59:59.999Z",
  "2026-11-01T06:00:00.000Z",
  "2026-12-31T23:30:00.000Z",
  "2027-01-01T00:00:00.000Z",
  "2028-02-28T23:30:00.000Z",
  "2028-02-29T23:30:00.000Z",
];

const dstZones: Record<string, [string, string]> = {
  "Europe/Berlin": ["2026-03-28T12:00:00Z", "2026-03-30T12:00:00Z"],
  "America/New_York": ["2026-03-07T12:00:00Z", "2026-03-09T12:00:00Z"],
  "America/Los_Angeles": ["2026-03-07T12:00:00Z", "2026-03-09T12:00:00Z"],
  "America/Havana": ["2026-03-07T12:00:00Z", "2026-03-09T12:00:00Z"],
};

let bundle: Promise<string> | undefined;
function adapterBundle(): Promise<string> {
  bundle ??= build({
    entryPoints: [
      resolve(__dirname, "../../src/app/shared/utils/calendar-picker.ts"),
    ],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "picker",
    platform: "browser",
    logLevel: "silent",
  }).then((result) => result.outputFiles[0]!.text);
  return bundle;
}

for (const timezoneId of ZONES) {
  test.describe(`picker adapter in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test.beforeEach(async ({ page }) => {
      await page.goto("about:blank");
      await page.addScriptTag({ content: await adapterBundle() });
    });

    test("the browser really runs in the requested zone (CAL-06 setup)", async ({
      page,
    }) => {
      const zone = await page.evaluate(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      expect(zone).toBe(timezoneId);
      const pair = dstZones[timezoneId];
      if (pair) {
        const [winter, summer] = await page.evaluate(
          (iso) => iso.map((i) => new Date(i).getTimezoneOffset()),
          pair,
        );
        expect(winter, "DST switch lies between the two probes").not.toBe(
          summer,
        );
      }
    });

    test("BankDate <-> picker Date <-> carrier <-> MonthKey round trip without a day shift (CAL-06)", async ({
      page,
    }) => {
      const result = await page.evaluate((days) => {
        const p = (
          window as unknown as {
            picker: typeof import("../../src/app/shared/utils/calendar-picker");
          }
        ).picker;
        return days.map((day) => {
          const date = p.pickerDateFromBankDate(day);
          const carrier = `${day}T00:00:00.000Z`;
          return {
            day,
            localParts: [
              date.getFullYear(),
              date.getMonth() + 1,
              date.getDate(),
            ],
            back: p.bankDateFromPickerDate(date),
            toCarrier: p.bankDateLocalToCarrier(date),
            fromCarrier: p.bankDateFromPickerDate(
              p.pickerDateFromBankDateOrCarrier(carrier),
            ),
            storedValue: p.bankDateOfStoredValue(carrier),
            monthOfPicker: p.monthKeyFromPickerDate(date),
            monthOfCarrier: p.monthKeyOfBankDate(carrier),
            monthRoundTrip: p.monthKeyFromPickerDate(
              p.pickerDateFromMonthKey(p.monthKeyOfBankDate(carrier)),
            ),
            display: p.formatBankDate(carrier),
          };
        });
      }, DAYS);

      for (const r of result) {
        const [y, m, d] = r.day.split("-").map(Number);
        expect(r.localParts, `${r.day} local components`).toEqual([y, m, d]);
        expect(r.back, `${r.day} BankDate`).toBe(r.day);
        expect(r.toCarrier, `${r.day} carrier`).toBe(`${r.day}T00:00:00.000Z`);
        expect(r.fromCarrier, `${r.day} carrier -> picker -> BankDate`).toBe(
          r.day,
        );
        expect(r.storedValue).toBe(r.day);
        expect(r.monthOfPicker).toBe(r.day.slice(0, 7));
        expect(r.monthOfCarrier).toBe(r.day.slice(0, 7));
        expect(r.monthRoundTrip).toBe(r.day.slice(0, 7));
        expect(r.display).toBe(r.day.split("-").reverse().join("."));
      }
    });

    test("MonthKey round trip through the picker Date and month shifts (CAL-06, CAL-08)", async ({
      page,
    }) => {
      const result = await page.evaluate((months) => {
        const p = (
          window as unknown as {
            picker: typeof import("../../src/app/shared/utils/calendar-picker");
          }
        ).picker;
        return months.map((key) => {
          const date = p.pickerDateFromMonthKey(key);
          return {
            key,
            day: date.getDate(),
            back: p.monthKeyFromPickerDate(date),
            next: p.shiftMonthKey(key, 1),
            previous: p.shiftMonthKey(key, -1),
            anchor: p.toMonthKey(`${key}-01T00:00:00.000Z`),
            label: p.formatMonthKey(key, "yyyy-MM"),
          };
        });
      }, MONTHS);

      for (const r of result) {
        const first = DateTime.fromISO(`${r.key}-01`, { zone: "utc" });
        expect(r.day).toBe(1);
        expect(r.back).toBe(r.key);
        expect(r.next).toBe(first.plus({ months: 1 }).toFormat("yyyy-MM"));
        expect(r.previous).toBe(first.minus({ months: 1 }).toFormat("yyyy-MM"));
        expect(r.anchor).toBe(r.key);
        expect(r.label).toBe(r.key);
      }
    });

    test("the local calendar day for today follows the browser zone, the business month stays UTC (CAL-06)", async ({
      page,
    }) => {
      const result = await page.evaluate((instants) => {
        const p = (
          window as unknown as {
            picker: typeof import("../../src/app/shared/utils/calendar-picker");
          }
        ).picker;
        return instants.map((iso) => ({
          iso,
          today: p.todayBankDate(new Date(iso)),
          utcMonth: p.currentUtcMonthKey(new Date(iso)),
          carrier: p.bankDateLocalToCarrier(new Date(iso)),
        }));
      }, INSTANTS);

      for (const r of result) {
        const local = DateTime.fromISO(r.iso, { zone: timezoneId }).toISODate();
        expect(r.today, `${r.iso} local day`).toBe(local);
        expect(r.carrier, `${r.iso} carrier`).toBe(`${local}T00:00:00.000Z`);
        expect(r.utcMonth, `${r.iso} UTC month`).toBe(r.iso.slice(0, 7));
      }
    });

    test("stored legacy instants are read by their UTC day and the formatters never localize (CAL-06, CAL-09)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const p = (
          window as unknown as {
            picker: typeof import("../../src/app/shared/utils/calendar-picker");
          }
        ).picker;
        return {
          legacy: p.bankDateOfStoredValue("2026-11-01T23:30:00.000Z"),
          legacyEarly: p.bankDateOfStoredValue("2026-02-16T22:00:00.000Z"),
          formatted: p.formatBankDate("2026-11-01T00:00:00.000Z"),
          month: p.formatMonthValue("2026-12-01T00:00:00.000Z"),
          instant: p.formatInstant("2026-10-31T23:30:00.000Z"),
        };
      });
      expect(result.legacy).toBe("2026-11-01");
      expect(result.legacyEarly).toBe("2026-02-16");
      expect(result.formatted).toBe("01.11.2026");
      expect(result.month).toMatch(/Dez\.? 2026/);
      // a real instant is shown in the zone of the browser
      expect(result.instant).toBe(
        DateTime.fromISO("2026-10-31T23:30:00.000Z", { zone: timezoneId })
          .setLocale("de")
          .toFormat("dd.MM.yyyy HH:mm"),
      );
    });
  });
}
