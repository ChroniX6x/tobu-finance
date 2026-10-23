import { test, expect } from "./helpers/test-fixture";

test.use({ storageState: { cookies: [], origins: [] } });

test("real account, views and transaction create/edit/delete through the UI", async ({
  page,
}) => {
  test.setTimeout(90000);
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: process.env["E2E_EMAIL"],
      password: process.env["E2E_PASSWORD"],
    },
  });
  expect(login.status()).toBe(200);
  const auth = await login.json();
  const headers = { authorization: `Bearer ${auth.accessToken}` };
  const memberResponse = await page.request.post("/api/members", {
    headers,
    data: { name: "Browser owner", userId: auth.user.id },
  });
  expect(memberResponse.status()).toBe(201);
  const member = await memberResponse.json();
  const accountResponse = await page.request.post("/api/accounts", {
    headers,
    data: {
      name: "Browser account",
      members: [{ memberId: member._id, role: "owner" }],
    },
  });
  expect(accountResponse.status()).toBe(201);
  const account = await accountResponse.json();
  const accountPath = `/accounts/${account._id}`;
  // Explicit fixtures bypass the deferred Wizard user/member mapping (AUTH-002).
  for (const [url, endpoint] of [
    [accountPath, "overview"],
    [accountPath + "/manage/master-data", "master-data"],
    [accountPath + "/month", "month-view"],
    [accountPath + "/planning", "planning"],
  ]) {
    const loaded = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname ===
        `/api/accounts/${account._id}/${endpoint}`,
    );
    await page.goto(url);
    const response = await loaded;
    expect(response.status()).toBe(200);
    await response.finished();
    await page.waitForLoadState("networkidle");
  }
  await page.goto(accountPath + "/transactions");
  await page.getByRole("button", { name: /Neue Buchung/i }).click();
  await page.locator("#title").fill("Real UI expense");
  await page.locator("#amount").fill("12.34");
  const createdResponse = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/api/transactions",
  );
  await page.getByRole("button", { name: /Anlegen/ }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const transaction = await created.json();
  expect(transaction.amountMinor).toBe(1234);
  await page.reload();
  await page.getByText("Real UI expense", { exact: true }).click();
  await page.locator("#title").fill("Real UI changed");
  const patched = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" &&
      r.url().endsWith("/api/transactions/" + transaction._id),
  );
  await page.getByRole("button", { name: /Speichern/ }).click();
  expect((await patched).status()).toBe(200);
  await page.reload();
  const row = page.locator("tr").filter({ hasText: "Real UI changed" });
  await expect(row).toBeVisible();
  const deleted = page.waitForResponse(
    (r) =>
      r.request().method() === "DELETE" &&
      r.url().endsWith("/api/transactions/" + transaction._id),
  );
  await row.locator("button:has(.pi-trash)").click();
  expect((await deleted).status()).toBe(204);
  await page.reload();
  await expect(page.getByText("Real UI changed", { exact: true })).toHaveCount(
    0,
  );
  const list = await page.request.get(
    `/api/transactions?accountId=${account._id}`,
    { headers },
  );
  expect((await list.json()).total).toBe(0);
});
