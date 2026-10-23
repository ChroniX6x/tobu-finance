import { expect, test } from "./helpers/test-fixture";
import {
  ACCOUNT_ID,
  CAT_1_ID,
  mockTransactionsPageRoutes,
  mockTransaction,
  mockCategories,
} from "./helpers/mocks";

const url = `/accounts/${ACCOUNT_ID}/transactions`;

test.describe("Transactions page", () => {
  test.beforeEach(async ({ page, useMocks }) => {
    await mockTransactionsPageRoutes(page, useMocks);
    const transactionsLoaded = page.waitForResponse((response) => {
      const request = response.request();
      const requestUrl = new URL(response.url());
      return (
        request.method() === "GET" &&
        requestUrl.pathname === "/api/transactions" &&
        requestUrl.searchParams.get("accountId") === ACCOUNT_ID
      );
    });
    await page.goto(url);
    const response = await transactionsLoaded;
    expect(response.ok(), "Initial transaction request succeeds").toBe(true);
    expect(
      await response.finished(),
      "Initial transaction response finishes",
    ).toBeNull();
    // Navigation may complete before lazy components and their initial reload render.
    // Wait for the actual fixture row, not a sleep or a global assertion timeout.
    await expect(
      page.getByRole("row").filter({ hasText: mockTransaction.title }),
      "Initial transaction row is rendered before checking its individual cells",
    ).toBeVisible({ timeout: 15000 });
  });

  // ─── Tab navigation ───────────────────────────────────────────────────────

  test("renders the Buchungen tab as active", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /Buchungen/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test('"Übersicht" tab navigates to account overview', async ({ page }) => {
    await page.getByRole("tab", { name: /Übersicht/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/accounts/${ACCOUNT_ID}(/overview)?$`),
    );
  });

  // ─── Transaction list ─────────────────────────────────────────────────────

  test("shows the mocked transaction title", async ({ page }) => {
    await expect(page.getByText(mockTransaction.title)).toBeVisible();
  });

  test("shows the transaction amount", async ({ page }) => {
    // amountMinor 4500 → 45,00 or 45.00 depending on locale
    await expect(page.getByText(/45[\.,]00/).first()).toBeVisible();
  });

  test("shows the category name resolved from state", async ({ page }) => {
    const category = mockCategories.find((c) => c._id === CAT_1_ID)!;
    await expect(page.getByText(category.name).first()).toBeVisible();
  });

  // ─── Toolbar ─────────────────────────────────────────────────────────────

  test("renders the search input", async ({ page }) => {
    await expect(page.getByPlaceholder(/Suchen/i)).toBeVisible();
  });

  test('"Neue Buchung" button is present', async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Neue Buchung/i }),
    ).toBeVisible();
  });

  // ─── Capture dock ─────────────────────────────────────────────────────────

  test("capture dock toggle button is visible in collapsed state", async ({
    page,
  }) => {
    await expect(
      page
        .locator(".capture-dock-tab")
        .getByRole("button", { name: /Capture/i }),
    ).toBeVisible();
  });

  test("clicking the dock toggle opens the capture panel", async ({ page }) => {
    await page
      .locator(".capture-dock-tab")
      .getByRole("button", { name: /Capture/i })
      .click();
    await expect(page.getByText("Quick Add")).toBeVisible();
  });

  test('"In Queue" button adds a draft to the queue', async ({ page }) => {
    // Open dock
    await page
      .locator(".capture-dock-tab")
      .getByRole("button", { name: /Capture/i })
      .click();

    // Fill required fields — amount and title; type, isFromSharedAccount, bookDate have valid defaults
    await page.locator("#amount-input").click();
    await page.locator("#amount-input").fill("25");
    await page.locator("#title-input").click();
    await page.locator("#title-input").fill("Supermarkt");

    await page.getByRole("button", { name: "In Queue" }).click();

    await expect(
      page.locator(".queue-list").getByText("Supermarkt"),
    ).toBeVisible();
  });

  test("empty queue shows placeholder text", async ({ page }) => {
    await page
      .locator(".capture-dock-tab")
      .getByRole("button", { name: /Capture/i })
      .click();
    await expect(
      page.getByText(/Noch keine Drafts in der Queue/i),
    ).toBeVisible();
  });

  test("closing the dock hides the capture panel", async ({ page }) => {
    // Open
    await page
      .locator(".capture-dock-tab")
      .getByRole("button", { name: /Capture/i })
      .click();
    await expect(page.getByText("Quick Add")).toBeVisible();
    // Close via collapse button
    await page.getByRole("button", { name: /Capture einklappen/i }).click();
    await expect(page.getByText("Quick Add")).not.toBeVisible();
  });

  // ─── Right panel placeholder ──────────────────────────────────────────────

  test("detail panel shows placeholder when no transaction is selected", async ({
    page,
  }) => {
    await expect(page.getByText(/Buchung auswählen/i)).toBeVisible();
  });
});
