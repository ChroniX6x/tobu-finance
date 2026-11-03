/**
 * H08-NACHTRAG-TESTS (EX-04, CAL-22 / F-4, CAL-21): the wizard assigns the initial month against the REAL API
 * (real JWT, real MongoDB), in four browser zones, and the AccountSnapshot month survives to the browser.
 *
 * The browser clock is `TOBU_TEST_NOW` when set (the real-stack runner forwards it to the API as well), otherwise
 * the real clock. The business month is always the UTC month of that instant, never the browser's local month.
 */
import { expect, test } from "./helpers/test-fixture";
import {
  createRealAccount,
  getJson,
  registerRealUser,
} from "./helpers/real-api";

test.use({ storageState: { cookies: [], origins: [] } });

const ZONES = [
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
] as const;

const FROZEN = process.env["TOBU_TEST_NOW"];
const clock = () => (FROZEN ? new Date(FROZEN) : new Date());
const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const anchor = (key: string) => `${key}-01T00:00:00.000Z`;
const shift = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(Date.UTC(y!, m! - 1 + delta, 1)));
};
const label = (key: string) =>
  new Intl.DateTimeFormat("de-DE", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(anchor(key)));

for (const timezoneId of ZONES) {
  test.describe(`real wizard and snapshot in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("wizard stores balance, incomes and budgets in the UTC month of the clock; cents stay exact (CAL-22, CAL-20)", async ({
      page,
    }) => {
      test.setTimeout(180000);
      const current = monthKey(clock());
      await page.clock.setFixedTime(clock());
      const user = await registerRealUser(page, `Wizard ${timezoneId}`);

      const seen = {
        balance: [] as Record<string, unknown>[],
        incomes: [] as Record<string, unknown>[],
        budgets: [] as Record<string, unknown>[],
      };
      page.on("request", (r) => {
        const path = new URL(r.url()).pathname;
        const body = () => r.postDataJSON() as Record<string, unknown>;
        if (path === "/api/account-balances" && r.method() === "PUT")
          seen.balance.push(body());
        if (path === "/api/member-incomes" && r.method() === "POST")
          seen.incomes.push(body());
        if (path === "/api/category-budgets" && r.method() === "POST")
          seen.budgets.push(body());
      });

      await page.goto("/wizard/1");
      await page.fill("#account-name", "Real wizard account");
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

      await page.locator("#account-balance").fill("1234.56");
      await page.locator("#member-balance-0").fill("1000.01");
      await page.locator("#member-balance-1").fill("2000.03");
      await page.locator("#category-estimation-0").fill("100.01");
      await page.locator("#category-estimation-1").fill("200.02");
      await page.locator("#category-estimation-1").blur();

      const budgetResponses: number[] = [];
      page.on("response", (r) => {
        if (
          new URL(r.url()).pathname === "/api/category-budgets" &&
          r.request().method() === "POST"
        )
          budgetResponses.push(r.status());
      });
      const created = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/accounts" &&
          r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Next" }).click();
      const account = await (await created).json();
      // The wizard navigates immediately (before the account exists, see the report); wait for the last write instead.
      await expect.poll(() => budgetResponses).toEqual([201, 201]);

      expect(seen.balance, "one balance upsert").toHaveLength(1);
      expect(seen.balance[0]).toEqual({
        accountId: account._id,
        month: current,
        closingBalanceMinor: 123456,
      });
      expect(seen.incomes.map((i) => i["fromMonth"])).toEqual([
        anchor(current),
        anchor(current),
      ]);
      expect(seen.incomes.map((i) => i["amountMinor"]).sort()).toEqual([
        100001, 200003,
      ]);
      expect(seen.budgets.map((b) => b["fromMonth"])).toEqual([
        anchor(current),
        anchor(current),
      ]);
      expect(seen.budgets.map((b) => b["amountMinor"]).sort()).toEqual([
        10001, 20002,
      ]);

      // Server side: what is stored is the same month and the same cents, read back through the API
      const balances = await getJson<
        { month: string; closingBalanceMinor: number }[]
      >(page, user, `/api/account-balances?accountId=${account._id}`);
      expect(
        balances.map((b) => [b.month, b.closingBalanceMinor]),
        "balance snapshot",
      ).toEqual([[anchor(current), 123456]]);
      const incomes = await getJson<
        { fromMonth: string; amountMinor: number }[]
      >(page, user, `/api/member-incomes?accountId=${account._id}`);
      expect(incomes.map((i) => i.fromMonth)).toEqual([
        anchor(current),
        anchor(current),
      ]);
      expect(incomes.map((i) => i.amountMinor).sort()).toEqual([
        100001, 200003,
      ]);
      const rules = await getJson<
        {
          type: string;
          fromMonth: string;
          toMonth: string | null;
          amountMinor: number;
        }[]
      >(page, user, `/api/contribution-rules?accountId=${account._id}`);
      const base = rules.filter((r) => r.type === "base");
      expect(
        base.map((r) => [r.fromMonth, r.toMonth, r.amountMinor]),
        "base rule spans the budget period and sums the budgets exactly",
      ).toEqual([[anchor(current), null, 30003]]);

      // The month before is untouched, the current month carries the budgets (no day or month shift)
      const due = async (key: string) =>
        (
          await getJson<{ kpis: { totalDueMinor: number } }>(
            page,
            user,
            `/api/accounts/${account._id}/month-view?month=${key}`,
          )
        ).kpis.totalDueMinor;
      expect(await due(shift(current, -1))).toBe(0);
      expect(await due(current)).toBe(30003);
      const view = await getJson<{
        members: { monthlyDueMinor: number }[];
        kpis: { totalDueMinor: number };
      }>(
        page,
        user,
        `/api/accounts/${account._id}/month-view?month=${current}`,
      );
      expect(
        view.members.reduce((sum, m) => sum + m.monthlyDueMinor, 0),
        "member shares add up to the total",
      ).toBe(view.kpis.totalDueMinor);
    });

    test("an AccountSnapshot keeps its UTC month in the browser, separate from the calendar month (CAL-21)", async ({
      page,
    }) => {
      test.setTimeout(120000);
      const current = monthKey(clock());
      const snapshotMonth = shift(current, -2);
      await page.clock.setFixedTime(clock());
      const user = await registerRealUser(page, `Snapshot ${timezoneId}`);
      const { account } = await createRealAccount(
        page,
        user,
        "Snapshot account",
      );
      const put = await page.request.put("/api/account-balances", {
        headers: user.headers,
        data: {
          accountId: account._id,
          month: snapshotMonth,
          closingBalanceMinor: 98765,
        },
      });
      expect(put.status(), await put.text()).toBeLessThan(300);

      const overviewResponse = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/accounts/${account._id}/overview`,
      );
      await page.goto(`/accounts/${account._id}`);
      const overview = await (await overviewResponse).json();
      expect(overview.account.currentMonth).toBe(anchor(snapshotMonth));
      expect(overview.account.currentBalanceMinor).toBe(98765);
      // A UTC anchor must not be shown in the browser zone: that would be the month before in the US zones
      await expect(page.getByText(label(snapshotMonth)).first()).toBeVisible();
      await expect(page.getByText(/€\s?988|988\s?€/).first()).toBeVisible();

      const summary = (
        await getJson<
          { id: string; currentMonth: string; currentBalanceMinor: number }[]
        >(page, user, "/api/accounts/summary?months=3")
      ).find((s) => s.id === account._id)!;
      expect([summary.currentMonth, summary.currentBalanceMinor]).toEqual([
        anchor(snapshotMonth),
        98765,
      ]);

      // the calendar month stays the clock's UTC month
      const monthView = await getJson<{ account: { monthIso: string } }>(
        page,
        user,
        `/api/accounts/${account._id}/month-view`,
      );
      expect(monthView.account.monthIso).toBe(current);
    });
  });
}
