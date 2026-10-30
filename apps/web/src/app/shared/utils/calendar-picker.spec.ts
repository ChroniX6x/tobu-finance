import {
  bankDateFromPickerDate,
  bankDateLocalToCarrier,
  bankDateOfStoredValue,
  currentUtcMonthKey,
  formatBankDate,
  formatMonthValue,
  monthKeyFromPickerDate,
  pickerDateFromBankDate,
  pickerDateFromBankDateOrCarrier,
  pickerDateFromMonthKey,
  todayBankDate,
} from "./calendar-picker";

describe("calendar-picker (browser zone of this runner)", () => {
  const days = [
    "2026-01-01",
    "2026-02-28",
    "2028-02-29",
    "2026-03-29",
    "2026-10-25",
    "2026-10-31",
    "2026-11-01",
    "2026-12-31",
  ];

  it("round-trips BankDate through the picker Date without day drift (CAL-06)", () => {
    for (const day of days) {
      expect(bankDateFromPickerDate(pickerDateFromBankDate(day))).toBe(day);
      expect(bankDateLocalToCarrier(pickerDateFromBankDate(day))).toBe(
        `${day}T00:00:00.000Z`,
      );
      expect(
        pickerDateFromBankDateOrCarrier(`${day}T00:00:00.000Z`).getDate(),
      ).toBe(Number(day.slice(8)));
    }
  });

  it("round-trips MonthKey through the picker Date (CAL-08)", () => {
    for (const key of [
      "2026-01",
      "2026-02",
      "2028-02",
      "2026-10",
      "2026-11",
      "2026-12",
    ]) {
      expect(monthKeyFromPickerDate(pickerDateFromMonthKey(key))).toBe(key);
    }
  });

  it("derives the business month from the UTC clock", () => {
    expect(currentUtcMonthKey(new Date("2026-10-31T23:30:00.000Z"))).toBe(
      "2026-10",
    );
    expect(currentUtcMonthKey(new Date("2026-11-01T00:00:00.000Z"))).toBe(
      "2026-11",
    );
  });

  it("uses the local calendar day for today", () => {
    expect(todayBankDate(new Date(2026, 10, 1, 0, 5))).toBe("2026-11-01");
    expect(todayBankDate(new Date(2026, 9, 31, 23, 55))).toBe("2026-10-31");
  });

  it("formats BankDates and months without localizing them", () => {
    expect(formatBankDate("2026-11-01T00:00:00.000Z")).toBe("01.11.2026");
    expect(formatMonthValue("2026-02-01T00:00:00.000Z")).toMatch(/Feb\.? 2026/);
    expect(formatMonthValue(undefined)).toBe("—");
  });

  it("reads legacy non-canonical values by their UTC day without throwing", () => {
    expect(bankDateOfStoredValue("2026-11-01T23:30:00.000Z")).toBe(
      "2026-11-01",
    );
    expect(() => bankDateOfStoredValue("2026-02-30")).toThrow();
  });
});
