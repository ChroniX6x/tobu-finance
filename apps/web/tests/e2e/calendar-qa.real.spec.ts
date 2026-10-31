/**
 * H06 – real browser x real REST x real MongoDB calendar QA (CAL-08, CAL-21, CAL-23..25, CAL-28).
 *
 * The browser clock is fixed to `TOBU_TEST_NOW` when it is set; the real-stack runner forwards the same
 * variable to the API process, so both apps see one instant. Without it both use the real clock.
 * The expected month is always the UTC month of that instant, independent of the browser zone.
 */
import { test, expect, type Page } from "./helpers/test-fixture";

test.use({ storageState: { cookies: [], origins: [] } });

const ZONES = [
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
] as const;

const FROZEN = process.env["TOBU_TEST_NOW"];
const clock = () => (FROZEN ? new Date(FROZEN) : new Date());

const utcMonthKey = (d: Date) => d.toISOString().slice(0, 7);
const anchor = (key: string) => `${key}-01T00:00:00.000Z`;
const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return utcMonthKey(d);
};

async function seed(page: Page, name: string) {
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: process.env["E2E_EMAIL"],
      password: process.env["E2E_PASSWORD"],
    },
  });
  expect(login.status()).toBe(200);
  const auth = await login.json();
  const headers = { authorization: `Bearer ${auth.accessToken}` };
  const post = async (path: string, data: unknown) => {
    const response = await page.request.post(path, { headers, data });
    expect(response.status(), `${path}: ${await response.text()}`).toBe(201);
    return response.json();
  };
  const owner = await post("/api/members", {
    name: `${name} owner`,
    userId: auth.user.id,
  });
  const other = await post("/api/members", { name: `${name} other` });
  const account = await post("/api/accounts", {
    name,
    members: [
      { memberId: owner._id, role: "owner" },
      { memberId: other._id, role: "member" },
    ],
  });
  return { headers, owner, other, account };
}

for (const timezoneId of ZONES) {
  test.describe(`real stack in browser zone ${timezoneId}`, () => {
    test.use({ timezoneId });

    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(clock());
    });

    // One login per zone: the login endpoint is rate limited and every context needs its own refresh cookie.
    test("calendar flows on the real stack (CAL-08, CAL-21, CAL-23..25)", async ({
      page,
    }) => {
      test.setTimeout(240000);
      const expected = utcMonthKey(clock());
      const { headers, account, other } = await seed(
        page,
        `Calendar ${timezoneId}`,
      );

      await test.step("month view, overview and navigation use the UTC month of the shared clock", async () => {
        const monthRequests: string[] = [];
        page.on("request", (r) => {
          const url = new URL(r.url());
          if (url.pathname === `/api/accounts/${account._id}/month-view`) {
            monthRequests.push(url.searchParams.get("month") ?? "");
          }
        });
        const view = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname ===
            `/api/accounts/${account._id}/month-view`,
        );
        await page.goto(`/accounts/${account._id}/month`);
        const first = await view;
        expect(first.status()).toBe(200);
        expect((await first.json()).account.monthIso).toBe(expected);
        expect(monthRequests[0]).toBe(expected);

        const next = shiftMonth(expected, 1);
        const nextResponse = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname ===
              `/api/accounts/${account._id}/month-view` &&
            new URL(r.url()).searchParams.get("month") === next,
        );
        await page.locator("button:has(.pi-chevron-right)").first().click();
        expect((await nextResponse).status()).toBe(200);
        const previous = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname ===
              `/api/accounts/${account._id}/month-view` &&
            new URL(r.url()).searchParams.get("month") === expected,
        );
        await page.locator("button:has(.pi-chevron-left)").first().click();
        expect((await previous).status()).toBe(200);

        const overviewResponse = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname ===
            `/api/accounts/${account._id}/overview`,
        );
        await page.goto(`/accounts/${account._id}`);
        const overview = await (await overviewResponse).json();
        expect(overview.account.currentMonth).toBe(anchor(expected));
      });

      await test.step("monthly payment drawer books the local day and the server derives the month (CAL-24)", async () => {
        const put = await page.request.post("/api/member-incomes", {
          headers,
          data: {
            accountId: account._id,
            memberId: other._id,
            amountMinor: 200000,
            fromMonth: shiftMonth(expected, -1),
            toMonth: null,
          },
        });
        expect(put.status(), await put.text()).toBe(201);
        const rule = await page.request.post("/api/contribution-rules", {
          headers,
          data: {
            accountId: account._id,
            type: "additional",
            recurring: true,
            amountMinor: 5000,
            distribution: { mode: "proRataIncome" },
            fromMonth: shiftMonth(expected, -1),
            toMonth: null,
          },
        });
        expect(rule.status(), await rule.text()).toBe(201);

        await page.goto(`/accounts/${account._id}/month`);
        const button = page
          .getByRole("button", { name: /Einzahlung buchen/ })
          .nth(1);
        await expect(button).toBeEnabled();
        await button.click();

        const localDay = await page.evaluate(() => {
          const d = new Date();
          return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0"),
          ].join("-");
        });
        const [response] = await Promise.all([
          page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === "/api/transactions" &&
              r.request().method() === "POST",
          ),
          // The drawer mask swallows pointer events while PrimeNG animates under automation.
          page
            .locator("form")
            .filter({ has: page.locator('button[type="submit"]') })
            .evaluate((f) => (f as HTMLFormElement).requestSubmit()),
        ]);
        expect(response.request().postDataJSON().month).toBeUndefined();
        expect(response.status(), await response.text()).toBe(201);
        const created = await response.json();
        expect(created.bookDate).toBe(`${localDay}T00:00:00.000Z`);
        expect(created.month).toBe(anchor(localDay.slice(0, 7)));
        expect(created.status).toBe("booked");
      });

      await test.step("parent and split children keep one BankDate and no PATCH is sent on open (CAL-25)", async () => {
        const day = `${utcMonthKey(clock())}-01`;
        const create = async (data: Record<string, unknown>) => {
          const response = await page.request.post("/api/transactions", {
            headers,
            data: {
              accountId: account._id,
              type: "expense",
              status: "booked",
              isFromSharedAccount: true,
              bookDate: `${day}T00:00:00.000Z`,
              ...data,
            },
          });
          expect(response.status(), await response.text()).toBe(201);
          return response.json();
        };
        const parent = await create({
          title: "Split parent",
          amountMinor: 1000,
        });
        const child = await create({
          title: "Split child",
          amountMinor: 333,
          parentTransactionId: parent._id,
        });
        expect(child.bookDate).toBe(parent.bookDate);
        expect(child.month).toBe(parent.month);

        let patches = 0;
        page.on("request", (r) => {
          if (r.method() === "PATCH") patches += 1;
        });
        await page.goto(`/accounts/${account._id}/transactions`);
        const label = day.split("-").reverse().join(".");
        await expect(
          page.getByRole("cell", { name: label }).first(),
        ).toBeVisible();
        await page.getByText("Split parent", { exact: true }).click();
        await expect(page.locator("#bookDate")).toHaveValue(label);
        await expect(
          page.getByRole("button", { name: "Speichern" }),
        ).toBeDisabled();
        expect(patches).toBe(0);

        const listed = await page.request.get(
          `/api/transactions?accountId=${account._id}`,
          { headers },
        );
        const items = (await listed.json()).items as {
          _id: string;
          bookDate: string;
          month: string;
          amountMinor: number;
          children?: { _id: string; bookDate: string; amountMinor: number }[];
        }[];
        const stored = items.find((t) => t._id === parent._id)!;
        expect(stored.bookDate).toBe(`${day}T00:00:00.000Z`);
        expect(stored.amountMinor).toBe(1000);
        for (const c of stored.children ?? []) {
          expect(c.bookDate).toBe(stored.bookDate);
        }
      });
    });
  });
}
