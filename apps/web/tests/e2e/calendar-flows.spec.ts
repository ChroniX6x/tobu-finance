/**
 * H04 gap closure: dock split with a non-canonical parent, wizard (CAL-22), planning month (CAL-23)
 * and removing an end month, each in several browser zones.
 */
import { expect, test, type Page } from "./helpers/test-fixture";
import {
  ACCOUNT_ID,
  CAT_1_ID,
  MEMBER_1_ID,
  mockAccountOverviewRoutes,
  mockTransactionsPageRoutes,
  mockWizardRoutes,
} from "./helpers/mocks";

const ZONES = [
  "Europe/Berlin",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "America/New_York",
] as const;
// Nov 1 in UTC, Berlin and Tokyo, still Oct 31 in the US zones
const CLOCK = new Date("2026-11-01T03:30:00.000Z");

const LEGACY_PARENT_DATE = "2026-02-16T22:00:00.000Z";

test.describe("Dock split with a non-canonical parent bookDate", () => {
  test("child is sent with the exact parent bookDate", async ({
    page,
    useMocks,
  }) => {
    let posted: Record<string, unknown> | null = null;
    await mockTransactionsPageRoutes(page, useMocks);
    await page.route("**/api/transactions?**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              _id: "400000000000000000000002",
              accountId: ACCOUNT_ID,
              type: "expense",
              amountMinor: 12000,
              status: "booked",
              bookDate: LEGACY_PARENT_DATE,
              month: "2026-02-01T00:00:00.000Z",
              title: "Aldi Einkauf",
              notes: null,
              categoryId: CAT_1_ID,
              isFromSharedAccount: false,
              paidByMemberId: MEMBER_1_ID,
              parentTransactionId: null,
              children: [],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 50,
        }),
      }),
    );
    await page.route("**/api/transactions", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      posted = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ...posted,
          _id: "400000000000000000000009",
          month: "2026-02-01T00:00:00.000Z",
          notes: null,
          categoryId: null,
          paidByMemberId: MEMBER_1_ID,
        }),
      });
    });

    await page.goto(`/accounts/${ACCOUNT_ID}/transactions`);
    await page.locator(".capture-dock-tab .dock-toggle-btn").click();
    await page.getByRole("button", { name: "Teil" }).click();
    const parentInput = page.locator('input[id^="parent-input"]');
    await parentInput.click();
    await parentInput.fill("Aldi");
    await page.getByRole("option", { name: /Aldi Einkauf/i }).click();
    await page.locator('input[id^="amount-input"]').fill("5");
    await page.locator("#title-input").fill("Teilbetrag");
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/transactions") &&
          r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Direkt speichern" }).click(),
    ]);
    expect(posted!["bookDate"]).toBe(LEGACY_PARENT_DATE);
    expect(posted!["parentTransactionId"]).toBe("400000000000000000000002");
  });
});

async function navigateToStep4(page: Page): Promise<void> {
  await page.fill("#account-name", "Test Account");
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForURL(/\/wizard\/2$/);
  for (const name of ["Tony Hoffmann", "Carolin Neumann"]) {
    await page.fill("#name", name);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(name)).toBeVisible();
  }
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForURL(/\/wizard\/3$/);
  for (const name of ["Lebensmittel", "Miete"]) {
    await page.fill("#name", name);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(name)).toBeVisible();
  }
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForURL(/\/wizard\/4$/);
}

const planning = (month: string) => ({
  accountId: ACCOUNT_ID,
  referenceMonth: month,
  overview: {
    activeBudgetSumMinor: 10000,
    activeBudgetCount: 1,
    activeContributionBlockCount: 0,
    proRataStatus: "notUsed" as const,
    hintCount: 0,
  },
  budgets: [
    {
      budgetId: "600000000000000000000001",
      categoryId: CAT_1_ID,
      categoryName: "Lebensmittel",
      amountMinor: 10000,
      fromMonth: "2026-01-01T00:00:00.000Z",
      toMonth: "2026-12-01T00:00:00.000Z",
      isActiveInReferenceMonth: true,
      hasOverlapConflict: false,
      usageHints: [],
    },
  ],
  incomes: [],
  contributionBlocks: [],
  specialBlocks: [],
  preview: { month, plannedNeedMinor: 0, memberDuePreview: [] },
  hints: [],
  categories: [{ id: CAT_1_ID, name: "Lebensmittel" }],
});

for (const timezoneId of ZONES) {
  test.describe(`Wizard and planning in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("wizard assigns the initial month by the UTC month in every zone (CAL-22)", async ({
      page,
      useMocks,
    }) => {
      const balances: Record<string, unknown>[] = [];
      const incomes: Record<string, unknown>[] = [];
      await page.clock.setFixedTime(CLOCK);
      await mockWizardRoutes(page, useMocks);
      await page.route("**/api/account-balances", (route) => {
        balances.push(route.request().postDataJSON());
        return route.fallback();
      });
      await page.route("**/api/member-incomes", (route) => {
        incomes.push(route.request().postDataJSON());
        return route.fallback();
      });
      await page.goto("/wizard/1");
      await navigateToStep4(page);
      await page.getByRole("button", { name: "Next" }).click();
      await expect.poll(() => balances.length).toBe(1);
      expect(balances[0]["month"]).toBe("2026-11");
      await expect.poll(() => incomes.length).toBe(2);
      expect(incomes.map((i) => i["fromMonth"])).toEqual([
        "2026-11-01T00:00:00.000Z",
        "2026-11-01T00:00:00.000Z",
      ]);
    });

    test("planning loads the UTC month and an end month can be removed (CAL-23)", async ({
      page,
    }) => {
      const months: string[] = [];
      let patched: Record<string, unknown> | null = null;
      await page.clock.setFixedTime(CLOCK);
      await mockAccountOverviewRoutes(page);
      await page.route(`**/api/accounts/${ACCOUNT_ID}/planning?**`, (route) => {
        const month =
          new URL(route.request().url()).searchParams.get("month") ?? "";
        months.push(month);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(planning(month)),
        });
      });
      await page.route(
        "**/api/category-budgets/600000000000000000000001",
        (route) => {
          if (route.request().method() !== "PATCH") return route.fallback();
          patched = route.request().postDataJSON() as Record<string, unknown>;
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              _id: "600000000000000000000001",
              accountId: ACCOUNT_ID,
              categoryId: CAT_1_ID,
              amountMinor: 10000,
              fromMonth: "2026-01-01T00:00:00.000Z",
              toMonth: null,
            }),
          });
        },
      );

      await page.goto(`/accounts/${ACCOUNT_ID}/planning`);
      await expect.poll(() => months[0]).toBe("2026-11");

      // The PrimeNG drawer mask intercepts pointer events under automation, so these clicks are dispatched on the elements.
      await page.locator("button:has(.pi-pencil)").first().click();
      await page
        .locator("p-drawer button:has(.pi-times)")
        .first()
        .dispatchEvent("click");
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/api/category-budgets/") &&
            r.request().method() === "PATCH",
        ),
        page.getByRole("button", { name: "Speichern" }).dispatchEvent("click"),
      ]);
      expect(response.status()).toBe(200);
      expect(patched!["toMonth"]).toBeNull();
      expect(patched!["fromMonth"]).toBe("2026-01");
    });
  });
}
