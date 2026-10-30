/**
 * H04 – UI calendar adapters across browser time zones (CAL-06/08, CAL-22..26).
 *
 * Every test runs in four browser contexts. BankDates and MonthKeys must neither shift nor
 * depend on the browser zone; only the user's local "today" may differ. Mock routes record the
 * requests and fulfil with contract-valid responses (the fixture validates them).
 */
import { expect, test, type Page } from "./helpers/test-fixture";
import {
  ACCOUNT_ID,
  MEMBER_1_ID,
  mockAccountOverviewRoutes,
  mockTransaction,
  mockTransactionsPageRoutes,
} from "./helpers/mocks";

const ZONES = [
  "Europe/Berlin",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "America/New_York",
] as const;

const boundaryTx = {
  ...mockTransaction,
  bookDate: "2026-11-01T00:00:00.000Z",
  month: "2026-11-01T00:00:00.000Z",
};

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
      lastPaymentDate: "2026-10-31T00:00:00.000Z",
      privateAdvancesMinor: 0,
    },
  ],
  categories: [],
  contributionBreakdown: [],
  memberIncomes: [],
  carryovers: [],
  categoryHistory: [],
});

async function mockMonthView(page: Page, requestedMonths: string[]) {
  await mockAccountOverviewRoutes(page);
  await page.route(`**/api/accounts/${ACCOUNT_ID}/month-view?**`, (route) => {
    const month =
      new URL(route.request().url()).searchParams.get("month") ?? "";
    requestedMonths.push(month);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(monthView(month)),
    });
  });
}

for (const timezoneId of ZONES) {
  test.describe(`Calendar adapters in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("transaction list and detail keep the BankDate; no phantom PATCH (CAL-25)", async ({
      page,
      useMocks,
    }) => {
      let patchCount = 0;
      await mockTransactionsPageRoutes(page, useMocks);
      await page.route("**/api/transactions?**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [boundaryTx],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        }),
      );
      await page.route(`**/api/transactions/${boundaryTx._id}`, (route) => {
        if (route.request().method() === "PATCH") patchCount += 1;
        return route.fallback();
      });

      await page.goto(`/accounts/${ACCOUNT_ID}/transactions`);
      await expect(
        page.getByRole("cell", { name: "01.11.2026" }),
      ).toBeVisible();

      await page.getByText(boundaryTx.title).click();
      await expect(page.locator("#bookDate")).toHaveValue("01.11.2026");
      await expect(
        page.getByRole("button", { name: "Speichern" }),
      ).toBeDisabled();
      expect(patchCount).toBe(0);
    });

    test("changing the date PATCHes the exact BankDate carrier (CAL-25)", async ({
      page,
      useMocks,
    }) => {
      let patchBody: Record<string, unknown> | null = null;
      await mockTransactionsPageRoutes(page, useMocks);
      await page.route("**/api/transactions?**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [boundaryTx],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        }),
      );
      await page.route(`**/api/transactions/${boundaryTx._id}`, (route) => {
        if (route.request().method() !== "PATCH") return route.fallback();
        patchBody = route.request().postDataJSON() as Record<string, unknown>;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...boundaryTx,
            ...patchBody,
            month: "2026-10-01T00:00:00.000Z",
          }),
        });
      });

      await page.goto(`/accounts/${ACCOUNT_ID}/transactions`);
      await page.getByText(boundaryTx.title).click();
      await page.locator("#bookDate").click();
      await page.locator(".p-datepicker-prev-button").click();
      await page
        .locator(".p-datepicker-day-view")
        .getByText("31", { exact: true })
        .click();
      await expect(page.locator("#bookDate")).toHaveValue("31.10.2026");

      const [response] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes(`/api/transactions/${boundaryTx._id}`) &&
            r.request().method() === "PATCH",
        ),
        page.getByRole("button", { name: "Speichern" }).click(),
      ]);
      expect(response.status()).toBe(200);
      expect(patchBody).toEqual({ bookDate: "2026-10-31T00:00:00.000Z" });
    });

    test("monthly payment drawer sends the local calendar day as carrier without month (CAL-24)", async ({
      page,
    }) => {
      const months: string[] = [];
      let posted: Record<string, unknown> | null = null;
      await page.clock.setFixedTime(new Date("2026-11-01T03:30:00.000Z"));
      await mockMonthView(page, months);
      await page.route("**/api/transactions", (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        posted = route.request().postDataJSON() as Record<string, unknown>;
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ...mockTransaction,
            ...posted,
            _id: "400000000000000000000009",
          }),
        });
      });

      await page.goto(`/accounts/${ACCOUNT_ID}/month`);
      // lastPaymentDate is a BankDate carrier and must not be shifted by the browser zone
      await expect(page.getByText("31.10.2026")).toBeVisible();
      await page
        .getByRole("button", { name: /Einzahlung buchen/ })
        .first()
        .click();

      const localDay = await page.evaluate(() => {
        const d = new Date();
        return [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, "0"),
          String(d.getDate()).padStart(2, "0"),
        ].join("-");
      });
      await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/transactions") &&
            r.request().method() === "POST",
        ),
        // PrimeNG keeps the drawer mask in its enter-animation state under automation and it swallows pointer events,
        // so the form is submitted programmatically.
        page
          .locator("form")
          .filter({ has: page.locator('button[type="submit"]') })
          .evaluate((f) => (f as HTMLFormElement).requestSubmit()),
      ]);
      expect(posted!["bookDate"]).toBe(`${localDay}T00:00:00.000Z`);
      expect(posted!["month"]).toBeUndefined();
      expect(posted!["status"]).toBe("booked");
    });

    test("month navigation uses UTC month keys independent of the browser zone (CAL-08, CAL-23)", async ({
      page,
    }) => {
      const months: string[] = [];
      // 2026-10-31T23:30Z is already November in Tokyo but still October in UTC
      await page.clock.setFixedTime(new Date("2026-10-31T23:30:00.000Z"));
      await mockMonthView(page, months);

      await page.goto(`/accounts/${ACCOUNT_ID}/month`);
      await expect.poll(() => months.at(-1)).toBe("2026-10");

      const before = months.length;
      await page.locator("button:has(.pi-chevron-right)").first().click();
      await expect.poll(() => months.length).toBeGreaterThan(before);
      expect(months.at(-1)).toBe("2026-11");
      await page.locator("button:has(.pi-chevron-left)").first().click();
      await expect.poll(() => months.at(-1)).toBe("2026-10");
    });

    test("account overview shows the stored month, not the previous one (CAL-21)", async ({
      page,
      useMocks,
    }) => {
      await mockAccountOverviewRoutes(page, useMocks);
      await page.goto(`/accounts/${ACCOUNT_ID}`);
      await expect(page.getByText(/Feb\.? 2026/).first()).toBeVisible();
    });
  });
}
