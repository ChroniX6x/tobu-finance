import { test, expect } from "./helpers/test-fixture";
import { mockAccountsListRoutes } from "./helpers/mocks";

test("protected initial navigation waits for session restoration", async ({
  page,
}) => {
  await mockAccountsListRoutes(page);
  let releaseRefresh!: () => void;
  const released = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let refreshStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    refreshStarted = resolve;
  });
  await page.route("**/api/auth/refresh", async (route) => {
    refreshStarted();
    await released;
    await route.fulfill({ json: { accessToken: "e2e-token" } });
  });
  try {
    await page.goto("/accounts", { waitUntil: "domcontentloaded" });
    await started;
    // Keep refresh pending until the document has loaded, exposing startup races.
    await page.waitForLoadState("load");
    // Fault injection: allow lazy route loading to finish while refresh is still pending.
    // This delay simulates a slow auth server; it is not a readiness workaround.
    await page.waitForTimeout(5000);
  } finally {
    releaseRefresh();
  }
  await expect(page.getByRole("heading", { name: "Deine Konten" })).toBeVisible(
    { timeout: 15000 },
  );
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(
    page.getByRole("button", { name: "Login", exact: true }),
  ).toHaveCount(0);
});
