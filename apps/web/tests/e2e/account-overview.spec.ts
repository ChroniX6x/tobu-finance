import { expect, test } from "./helpers/test-fixture";
import {
  ACCOUNT_ID,
  mockAccountOverview,
  mockAccountOverviewRoutes,
  mockTransactionsPageRoutes,
  mockTransaction,
} from "./helpers/mocks";

const url = `/accounts/${ACCOUNT_ID}`;

test.describe("Account overview page", () => {
  test.beforeEach(async ({ page, useMocks }) => {
    await mockAccountOverviewRoutes(page, useMocks);
    await page.goto(url);
  });

  test("shows the account name", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: mockAccountOverview.account.name }),
    ).toBeVisible();
  });

  test("shows the current balance", async ({ page }) => {
    // Wait for the account name heading to confirm the page has loaded
    await expect(
      page.getByRole("heading", { name: mockAccountOverview.account.name }),
    ).toBeVisible();
    // 250000 minor → 2500 EUR, Angular currency:'EUR' with 1.0-0 → "€2,500" (en-US locale)
    await expect(page.getByText(/2[,.]500/).first()).toBeVisible();
  });

  test("shows all members", async ({ page }) => {
    for (const member of mockAccountOverview.members) {
      await expect(page.getByText(member.name).first()).toBeVisible();
    }
  });

  test("marks paid member with check icon", async ({ page }) => {
    // Caro is paid=true → rendered with pi-check class
    const caroBadge = page
      .locator("div")
      .filter({ hasText: "Caro" })
      .filter({ has: page.locator(".pi-check") });
    await expect(caroBadge.first()).toBeVisible();
  });

  test("marks unpaid member with clock icon", async ({ page }) => {
    const tobiBadge = page
      .locator("div")
      .filter({ hasText: "Tobi" })
      .filter({ has: page.locator(".pi-clock") });
    await expect(tobiBadge.first()).toBeVisible();
  });

  for (const delayMs of [0, 6000]) {
    test(`"Buchungen" tab navigates to transactions page (resolver delay ${delayMs}ms)`, async ({
      page,
      useMocks,
    }) => {
      // Also set up the transactions-page mocks so navigating to /transactions doesn't
      // trigger an API failure → auth redirect
      await mockTransactionsPageRoutes(page, useMocks);
      if (delayMs) {
        // Fault injection: the first resolver response takes longer than the default URL assertion limit.
        await page.route(
          "**/api/transactions?**",
          async (route) => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            await route.fallback();
          },
          { times: 1 },
        );
      }
      await expect(
        page.getByRole("heading", { name: mockAccountOverview.account.name }),
      ).toBeVisible({ timeout: 15000 });
      // Lazy route loading and resolvers finish before Angular commits the new URL.
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) => {
            const requestUrl = new URL(response.url());
            return (
              response.request().method() === "GET" &&
              requestUrl.pathname === "/api/transactions" &&
              requestUrl.searchParams.get("accountId") === ACCOUNT_ID
            );
          },
          { timeout: 15000 },
        ),
        page.getByRole("tab", { name: /Buchungen/i }).click(),
      ]);
      expect(response.status(), "Transactions resolver response").toBe(200);
      expect(await response.finished()).toBeNull();
      await expect(page).toHaveURL(
        new RegExp(`/accounts/${ACCOUNT_ID}/transactions`),
      );
      await expect(
        page.getByRole("tab", { name: /Buchungen/i }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        page.getByRole("row").filter({ hasText: mockTransaction.title }),
      ).toBeVisible({ timeout: 15000 });
    });
  }

  test('"Übersicht" tab is active by default', async ({ page }) => {
    await expect(page.getByRole("tab", { name: /Übersicht/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
