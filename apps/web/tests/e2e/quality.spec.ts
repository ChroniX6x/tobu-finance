import { test, expect } from "./helpers/test-fixture";
import { installMockGuard } from "./helpers/mock-guard";
import { ACCOUNT_ID, mockTransactionsPageRoutes } from "./helpers/mocks";

test("missing mock is blocked with method and path instead of reaching the proxy", async ({
  page,
}) => {
  const errors: string[] = [];
  await installMockGuard(page, (message) => errors.push(message));
  await page.goto("/notfound");
  errors.length = 0; // The app initializer may attempt auth/refresh on this diagnostic page.
  const failed = await page.evaluate(async () => {
    try {
      await fetch("/api/deliberately-missing");
      return false;
    } catch {
      return true;
    }
  });
  expect(failed).toBe(true);
  expect(errors).toContain(
    "Unmocked API request: GET /api/deliberately-missing",
  );
});

test("pending transaction without date requires an explicit month", async ({
  page,
}) => {
  await mockTransactionsPageRoutes(page);
  await page.goto(`/accounts/${ACCOUNT_ID}/transactions`);
  await page.getByRole("button", { name: /Neue Buchung/i }).click();
  await page.locator("#title").fill("Pending month");
  await page.locator("#amount").fill("10");
  await page.locator("#status").click();
  await page.getByRole("option", { name: "Ausstehend", exact: true }).click();
  await page.locator("#bookDate").fill("");
  await page.locator("#bookDate").press("Tab");
  await expect(page.locator("#transactionMonth")).toBeVisible();
  await page.getByRole("button", { name: /Anlegen/ }).click();
  await expect(page.getByText("Bitte einen Monat auswählen.")).toBeVisible();
  await page.locator("#transactionMonth").fill("2026-04");
  const posted = page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      new URL(r.url()).pathname === "/api/transactions",
  );
  await page.getByRole("button", { name: /Anlegen/ }).click();
  expect((await posted).postDataJSON()).toMatchObject({
    month: "2026-04",
    bookDate: null,
    status: "pending",
  });
});
