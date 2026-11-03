/**
 * H08-NACHTRAG-TESTS (EX-02, CAL-08): month navigation and month selection around January, December,
 * the year change and the leap-year February in four real browser zones.
 *
 * The browser clock is fixed to an instant that lies in a different calendar month in at least one of the
 * zones; the business month is always the UTC month of that instant. Mock routes fulfil with
 * contract-valid responses (the fixture validates them) and record the requested month keys.
 */
import { expect, test, type Page } from "./helpers/test-fixture";
import {
  ACCOUNT_ID,
  CAT_1_ID,
  MEMBER_1_ID,
  mockAccountOverviewRoutes,
} from "./helpers/mocks";

const ZONES = [
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
] as const;

type Step = readonly ["prev" | "next", string];
const CASES: {
  name: string;
  now: string;
  start: string;
  steps: readonly Step[];
}[] = [
  {
    name: "January (UTC) while Berlin/Tokyo are already or still in another month",
    now: "2026-01-01T00:30:00.000Z",
    start: "2026-01",
    steps: [
      ["prev", "2025-12"],
      ["next", "2026-01"],
      ["next", "2026-02"],
    ],
  },
  {
    name: "December and the year change",
    now: "2026-12-31T23:30:00.000Z",
    start: "2026-12",
    steps: [
      ["next", "2027-01"],
      ["prev", "2026-12"],
      ["next", "2027-01"],
      ["next", "2027-02"],
    ],
  },
  {
    name: "leap-year February",
    now: "2028-02-29T23:30:00.000Z",
    start: "2028-02",
    steps: [
      ["next", "2028-03"],
      ["prev", "2028-02"],
      ["prev", "2028-01"],
      ["prev", "2027-12"],
    ],
  },
  {
    name: "non-leap February",
    now: "2027-02-28T23:30:00.000Z",
    start: "2027-02",
    steps: [
      ["next", "2027-03"],
      ["prev", "2027-02"],
      ["prev", "2027-01"],
    ],
  },
];

const monthView = (month: string) => ({
  account: { id: ACCOUNT_ID, name: "E2E Konto", monthIso: month },
  kpis: {
    totalDueMinor: 10000,
    totalPaidMinor: 0,
    totalSpentMinor: 0,
    carryoverTotalMinor: 0,
  },
  members: [
    {
      id: MEMBER_1_ID,
      name: "Alice",
      avatar: null,
      role: "owner" as const,
      monthlyDueMinor: 10000,
      paidAmountMinor: 0,
      openAmountMinor: 10000,
      paid: false,
      carryoverMinor: 0,
      lastPaymentDate: null,
      privateAdvancesMinor: 0,
    },
  ],
  categories: [],
  contributionBreakdown: [],
  memberIncomes: [],
  carryovers: [],
  categoryHistory: [],
});

const planning = (month: string) => ({
  accountId: ACCOUNT_ID,
  referenceMonth: month,
  overview: {
    activeBudgetSumMinor: 0,
    activeBudgetCount: 0,
    activeContributionBlockCount: 0,
    proRataStatus: "notUsed" as const,
    hintCount: 0,
  },
  budgets: [],
  incomes: [],
  contributionBlocks: [],
  specialBlocks: [],
  preview: { month, plannedNeedMinor: 0, memberDuePreview: [] },
  hints: [],
  categories: [{ id: CAT_1_ID, name: "Lebensmittel" }],
});

async function mockRoute(
  page: Page,
  kind: "month-view" | "planning",
  requested: string[],
) {
  await mockAccountOverviewRoutes(page);
  await page.route(`**/api/accounts/${ACCOUNT_ID}/${kind}?**`, (route) => {
    const month =
      new URL(route.request().url()).searchParams.get("month") ?? "";
    requested.push(month);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        kind === "month-view" ? monthView(month) : planning(month),
      ),
    });
  });
}

/** Opens the month picker, walks to the target year and picks a month; synchronizes on the rendered year and the closed panel. */
async function pickMonth(
  page: Page,
  shownYear: number,
  monthIndex: number,
  targetYear: number,
) {
  const yearLabel = page.locator(".p-datepicker-select-year");
  await page.locator("p-datepicker input").click();
  await expect(yearLabel).toHaveText(String(shownYear));
  for (let y = shownYear; y !== targetYear; y += Math.sign(targetYear - y)) {
    const next = y + Math.sign(targetYear - y);
    await page
      .locator(
        next > y ? ".p-datepicker-next-button" : ".p-datepicker-prev-button",
      )
      .dispatchEvent("click");
    await expect(yearLabel).toHaveText(String(next));
  }
  await page
    .locator(".p-datepicker-month-view .p-datepicker-month")
    .nth(monthIndex)
    // PrimeNG re-renders the cells during its overlay animation under automation, so they never become `stable`.
    .dispatchEvent("click");
  await expect(page.locator(".p-datepicker-month-view")).toHaveCount(0);
}
for (const timezoneId of ZONES) {
  test.describe(`month navigation in ${timezoneId}`, () => {
    test.use({ timezoneId });

    for (const c of CASES) {
      test(`month view chevrons: ${c.name} (CAL-08)`, async ({ page }) => {
        const months: string[] = [];
        await page.clock.setFixedTime(new Date(c.now));
        await mockRoute(page, "month-view", months);

        await page.goto(`/accounts/${ACCOUNT_ID}/month`);
        await expect.poll(() => months.at(-1)).toBe(c.start);
        expect(months).toEqual([c.start]);

        for (const [direction, expected] of c.steps) {
          const before = months.length;
          await page
            .locator(
              `button:has(.pi-chevron-${direction === "next" ? "right" : "left"})`,
            )
            .first()
            .click();
          await expect.poll(() => months.length).toBe(before + 1);
          expect(months.at(-1), `${direction} -> ${expected}`).toBe(expected);
        }
      });

      test(`month view picker selects the exact month and year: ${c.name} (CAL-08)`, async ({
        page,
      }) => {
        const months: string[] = [];
        await page.clock.setFixedTime(new Date(c.now));
        await mockRoute(page, "month-view", months);
        await page.goto(`/accounts/${ACCOUNT_ID}/month`);
        await expect.poll(() => months.at(-1)).toBe(c.start);

        const year = Number(c.start.slice(0, 4));
        let shown = year;
        const pick = async (monthIndex: number, target: number) => {
          const before = months.length;
          await pickMonth(page, shown, monthIndex, target);
          shown = target;
          await expect.poll(() => months.length).toBe(before + 1);
          return months.at(-1);
        };

        expect(await pick(11, year)).toBe(`${year}-12`);
        expect(await pick(0, year + 1)).toBe(`${year + 1}-01`);
        expect(await pick(1, year)).toBe(`${year}-02`);
        expect(await pick(0, year - 1)).toBe(`${year - 1}-01`);
        await expect
          .poll(() => page.locator("p-datepicker input").inputValue())
          .toMatch(new RegExp(`${year - 1}$`));
      });
    }

    test("planning month picker requests the selected month across the year change (CAL-08)", async ({
      page,
    }) => {
      const months: string[] = [];
      await page.clock.setFixedTime(new Date("2026-12-31T23:30:00.000Z"));
      await mockRoute(page, "planning", months);
      await page.goto(`/accounts/${ACCOUNT_ID}/planning`);
      await expect.poll(() => months.at(-1)).toBe("2026-12");

      const start = months.length;
      await pickMonth(page, 2026, 0, 2027);
      await expect.poll(() => months.length).toBe(start + 1);
      expect(months.at(-1)).toBe("2027-01");

      await pickMonth(page, 2027, 1, 2026);
      await expect.poll(() => months.length).toBe(start + 2);
      expect(months.at(-1)).toBe("2026-02");
    });
  });
}
