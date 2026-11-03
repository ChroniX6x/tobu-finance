/**
 * H08-NACHTRAG-TESTS (EX-06, CAL-26, W09): the month filter of the transactions page (URL/filter -> API request)
 * in four real browser zones around the year change and the leap-year February.
 *
 * The web app consumes no month from its own URL (see the report); the only month-valued filter that reaches the
 * API from the UI is the toolbar range picker. It must send `monthFrom`/`monthTo` as exact `YYYY-MM` keys.
 */
import { expect, test, type Page } from "./helpers/test-fixture";
import {
  ACCOUNT_ID,
  mockCategories,
  mockAccountOverviewRoutes,
  mockMembers,
  mockTransaction,
} from "./helpers/mocks";

const ZONES = [
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
] as const;

// 2026-12-31T23:30Z is already 2027-01-01 in Berlin and Tokyo but still 2026-12-31 in both US zones
const NOW = new Date("2026-12-31T23:30:00.000Z");

async function mockList(page: Page, requests: URL[]) {
  await mockAccountOverviewRoutes(page);
  await page.route(`**/api/categories?accountId=${ACCOUNT_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCategories),
    }),
  );
  await page.route("**/api/members**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockMembers),
    }),
  );
  await page.route("**/api/transactions?**", (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [mockTransaction],
        total: 1,
        page: 1,
        pageSize: 50,
      }),
    });
  });
}

/** Opens the range picker, walks to the target year and selects one month. */
async function pickRangeMonth(
  page: Page,
  monthIndex: number,
  targetYear: number,
) {
  const yearLabel = page.locator(".p-datepicker-select-year");
  if (!(await yearLabel.isVisible())) {
    await page.locator("p-datepicker input").click();
  }
  await expect(yearLabel).toHaveText(/^\s*\d{4}\s*$/);
  for (;;) {
    const shown = Number((await yearLabel.innerText()).trim());
    if (shown === targetYear) break;
    const next = shown + Math.sign(targetYear - shown);
    await page
      .locator(
        next > shown
          ? ".p-datepicker-next-button"
          : ".p-datepicker-prev-button",
      )
      .dispatchEvent("click");
    await expect(yearLabel).toHaveText(String(next));
  }
  // PrimeNG re-renders the cells during its overlay animation under automation, so they never become `stable`.
  await page
    .locator(".p-datepicker-month-view .p-datepicker-month")
    .nth(monthIndex)
    .dispatchEvent("click");
}

const RANGES = [
  {
    name: "year change Dec 2026 - Feb 2027",
    from: [11, 2026],
    to: [1, 2027],
    monthFrom: "2026-12",
    monthTo: "2027-02",
    chip: "Zeitraum: 01.12.2026 – 01.02.2027",
  },
  {
    name: "leap-year February 2028 - March 2028",
    from: [1, 2028],
    to: [2, 2028],
    monthFrom: "2028-02",
    monthTo: "2028-03",
    chip: "Zeitraum: 01.02.2028 – 01.03.2028",
  },
  {
    name: "January only range Jan 2027 - Jan 2027",
    from: [0, 2027],
    to: [0, 2027],
    monthFrom: "2027-01",
    monthTo: "2027-01",
    chip: "Zeitraum: 01.01.2027 – 01.01.2027",
  },
] as const;

for (const timezoneId of ZONES) {
  test.describe(`month filter in ${timezoneId}`, () => {
    test.use({ timezoneId });

    for (const range of RANGES) {
      test(`toolbar range sends exact month keys: ${range.name} (CAL-26)`, async ({
        page,
      }) => {
        const requests: URL[] = [];
        await page.clock.setFixedTime(NOW);
        await mockList(page, requests);
        await page.goto(`/accounts/${ACCOUNT_ID}/transactions`);
        await expect.poll(() => requests.length).toBeGreaterThan(0);
        for (const url of requests) {
          expect(url.searchParams.get("monthFrom")).toBeNull();
          expect(url.searchParams.get("monthTo")).toBeNull();
        }

        const before = requests.length;
        await pickRangeMonth(page, range.from[0], range.from[1]);
        await expect.poll(() => requests.length).toBeGreaterThan(before);
        // first click of a range: only the lower bound is known
        expect(requests.at(-1)!.searchParams.get("monthFrom")).toBe(
          range.monthFrom,
        );
        expect(requests.at(-1)!.searchParams.get("monthTo")).toBeNull();

        await pickRangeMonth(page, range.to[0], range.to[1]);
        await expect
          .poll(() => requests.at(-1)!.searchParams.get("monthTo"))
          .toBe(range.monthTo);
        const last = requests.at(-1)!;
        expect(last.searchParams.get("monthFrom")).toBe(range.monthFrom);
        expect(last.searchParams.get("accountId")).toBe(ACCOUNT_ID);
        await expect(page.getByText(range.chip)).toBeVisible();

        // removing the chip drops both bounds again
        const afterRange = requests.length;
        await page
          .locator("p-chip", { hasText: range.chip })
          .locator(".p-chip-remove-icon")
          .dispatchEvent("click");
        await expect.poll(() => requests.length).toBeGreaterThan(afterRange);
        expect(requests.at(-1)!.searchParams.get("monthFrom")).toBeNull();
        expect(requests.at(-1)!.searchParams.get("monthTo")).toBeNull();
      });
    }
  });
}
