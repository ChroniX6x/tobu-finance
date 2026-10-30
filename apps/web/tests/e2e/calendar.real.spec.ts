import { test, expect } from "./helpers/test-fixture";

test.use({ storageState: { cookies: [], origins: [] } });

// 2026-11-01T03:30Z: still Oct 31 in Los Angeles, already Nov 1 in Tokyo, Nov 1 in UTC.
const CLOCK = new Date("2026-11-01T03:30:00.000Z");
const CASES = [
  {
    timezoneId: "America/Los_Angeles",
    day: "2026-10-31",
    month: "2026-10",
    label: "31.10.2026",
  },
  {
    timezoneId: "Asia/Tokyo",
    day: "2026-11-01",
    month: "2026-11",
    label: "01.11.2026",
  },
] as const;

for (const c of CASES) {
  test.describe(`real API calendar roundtrip in ${c.timezoneId}`, () => {
    test.use({ timezoneId: c.timezoneId });

    test("BankDate and derived month survive create, reload and open without a PATCH (CAL-10, CAL-25)", async ({
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
      const member = await (
        await page.request.post("/api/members", {
          headers,
          data: { name: "Calendar owner", userId: auth.user.id },
        })
      ).json();
      const account = await (
        await page.request.post("/api/accounts", {
          headers,
          data: {
            name: "Calendar account",
            members: [{ memberId: member._id, role: "owner" }],
          },
        })
      ).json();

      await page.clock.setFixedTime(CLOCK);
      let patches = 0;
      page.on("request", (r) => {
        if (r.method() === "PATCH") patches += 1;
      });

      await page.goto(`/accounts/${account._id}/transactions`);
      await page.getByRole("button", { name: /Neue Buchung/i }).click();
      await page.locator("#title").fill("Calendar roundtrip");
      await page.locator("#amount").fill("12.34");
      const createdResponse = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          new URL(r.url()).pathname === "/api/transactions",
      );
      await page.getByRole("button", { name: /Anlegen/ }).click();
      const created = await createdResponse;
      expect(created.status()).toBe(201);
      const body = await created.json();
      expect(body.bookDate).toBe(`${c.day}T00:00:00.000Z`);
      expect(body.month).toBe(`${c.month}-01T00:00:00.000Z`);
      expect(body.amountMinor).toBe(1234);

      await page.reload();
      await expect(page.getByRole("cell", { name: c.label })).toBeVisible();
      await page.getByText("Calendar roundtrip", { exact: true }).click();
      await expect(page.locator("#bookDate")).toHaveValue(c.label);
      await expect(
        page.getByRole("button", { name: "Speichern" }),
      ).toBeDisabled();
      expect(patches).toBe(0);

      const read = await page.request.get(
        `/api/transactions?accountId=${account._id}`,
        { headers },
      );
      const stored = (await read.json()).items.find(
        (t: { _id: string }) => t._id === body._id,
      );
      expect(stored.bookDate).toBe(`${c.day}T00:00:00.000Z`);
      expect(stored.month).toBe(`${c.month}-01T00:00:00.000Z`);
    });
  });
}
