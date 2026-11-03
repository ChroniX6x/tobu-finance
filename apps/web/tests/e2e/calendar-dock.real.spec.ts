/**
 * H08-NACHTRAG-TESTS (EX-05, CAL-25): capture dock create, split child and detail edit with real
 * clicks against the REAL API (real JWT, real MongoDB), in four browser zones around a month boundary.
 *
 * The browser clock is fixed to 2026-10-31T23:30Z: October 31 in both US zones, already November 1 in Berlin
 * and Tokyo. Evidence per step: the carrier in the request, the month the server derived, no PATCH while opening,
 * parent and child amounts unchanged.
 */
import { DateTime } from "luxon";
import { expect, test } from "./helpers/test-fixture";
import {
  createRealAccount,
  getJson,
  postJson,
  registerRealUser,
} from "./helpers/real-api";

test.use({ storageState: { cookies: [], origins: [] } });

const ZONES = [
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
] as const;

const NOW = new Date("2026-10-31T23:30:00.000Z");
const PARENT_DAY = "2026-10-31";

interface Tx {
  _id: string;
  title: string;
  amountMinor: number;
  bookDate: string;
  month: string;
  parentTransactionId?: string | null;
  children?: Tx[];
}

for (const timezoneId of ZONES) {
  test.describe(`real dock and editor in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("dock create, split child and detail edit keep the carrier and the server month (CAL-25)", async ({
      page,
    }) => {
      test.setTimeout(240000);
      const localDay = DateTime.fromJSDate(NOW, {
        zone: timezoneId,
      }).toISODate()!;
      const localMonthAnchor = `${localDay.slice(0, 7)}-01T00:00:00.000Z`;

      await page.clock.setFixedTime(NOW);
      const user = await registerRealUser(page, `Dock ${timezoneId}`);
      const { account } = await createRealAccount(page, user, "Dock account");
      const parent = await postJson<Tx>(page, user, "/api/transactions", {
        accountId: account._id,
        type: "expense",
        status: "booked",
        isFromSharedAccount: true,
        bookDate: `${PARENT_DAY}T00:00:00.000Z`,
        title: "Dock parent",
        amountMinor: 10001,
      });
      expect(parent.month).toBe("2026-10-01T00:00:00.000Z");

      const patches: { url: string; body: Record<string, unknown> }[] = [];
      page.on("request", (r) => {
        if (r.method() === "PATCH")
          patches.push({
            url: r.url(),
            body: r.postDataJSON() as Record<string, unknown>,
          });
      });
      const postedTo = () =>
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/transactions" &&
            r.request().method() === "POST",
        );

      await page.goto(`/accounts/${account._id}/transactions`);
      await expect(
        page.getByText("Dock parent", { exact: true }),
      ).toBeVisible();
      await page.locator(".capture-dock-tab .dock-toggle-btn").click();

      await test.step("dock create (direct save) books the local calendar day, the server derives the month", async () => {
        await page.locator('input[id^="amount-input"]').fill("12,34");
        await page.locator("#title-input").fill("Dock direct");
        const [response] = await Promise.all([
          postedTo(),
          page.getByRole("button", { name: "Direkt speichern" }).click(),
        ]);
        expect(response.status(), await response.text()).toBe(201);
        const sent = response.request().postDataJSON();
        expect(sent.bookDate).toBe(`${localDay}T00:00:00.000Z`);
        expect(sent.month).toBeUndefined();
        expect(sent).toMatchObject({
          type: "expense",
          status: "booked",
          amountMinor: 1234,
          parentTransactionId: null,
        });
        const created = (await response.json()) as Tx;
        expect(created.bookDate).toBe(`${localDay}T00:00:00.000Z`);
        expect(created.month).toBe(localMonthAnchor);
        expect(created.amountMinor).toBe(1234);
      });

      await test.step("dock create via queue and 'Alle speichern' sends the same carrier", async () => {
        await page.locator('input[id^="amount-input"]').fill("5,55");
        await page.locator("#title-input").fill("Dock queued");
        await page.getByRole("button", { name: "In Queue" }).click();
        const [response] = await Promise.all([
          postedTo(),
          page.getByRole("button", { name: "Alle speichern" }).click(),
        ]);
        expect(response.status(), await response.text()).toBe(201);
        const sent = response.request().postDataJSON();
        expect(sent.bookDate).toBe(`${localDay}T00:00:00.000Z`);
        expect(sent.month).toBeUndefined();
        const created = (await response.json()) as Tx;
        expect([created.month, created.amountMinor]).toEqual([
          localMonthAnchor,
          555,
        ]);
      });

      await test.step("dock split child inherits the parent's carrier, never the local day", async () => {
        await page.getByRole("button", { name: "Teil" }).click();
        const parentInput = page.locator('input[id^="parent-input"]');
        await parentInput.click();
        await parentInput.fill("Dock parent");
        await page.getByRole("option", { name: /Dock parent/ }).click();
        await page.locator('input[id^="amount-input"]').fill("33,33");
        await page.locator("#title-input").fill("Dock child");
        const [response] = await Promise.all([
          postedTo(),
          page.getByRole("button", { name: "Direkt speichern" }).click(),
        ]);
        expect(response.status(), await response.text()).toBe(201);
        const sent = response.request().postDataJSON();
        expect(sent.bookDate).toBe(parent.bookDate);
        expect(sent.parentTransactionId).toBe(parent._id);
        expect(sent.month).toBeUndefined();
        const child = (await response.json()) as Tx;
        expect(child.bookDate).toBe(parent.bookDate);
        expect(child.month).toBe(parent.month);
        expect(child.amountMinor).toBe(3333);
      });
      expect(patches, "no PATCH from the dock").toHaveLength(0);

      await test.step("opening the parent sends no PATCH; a title edit PATCHes only the title", async () => {
        await page
          .locator("table")
          .getByText("Dock parent", { exact: true })
          .click();
        await expect(page.locator("#bookDate")).toHaveValue("31.10.2026");
        await expect(
          page.getByRole("button", { name: /^\W*Speichern$/ }),
        ).toBeDisabled();
        await page.waitForLoadState("networkidle");
        expect(patches, "no PATCH while opening").toHaveLength(0);

        await page.locator("#title").fill("Dock parent edited");
        const [response] = await Promise.all([
          page.waitForResponse(
            (r) =>
              r.url().endsWith(`/api/transactions/${parent._id}`) &&
              r.request().method() === "PATCH",
          ),
          page.getByRole("button", { name: /^\W*Speichern$/ }).click(),
        ]);
        expect(response.status(), await response.text()).toBe(200);
        expect(patches).toHaveLength(1);
        expect(patches[0]!.body).toEqual({ title: "Dock parent edited" });
        const edited = (await response.json()) as Tx;
        expect([edited.bookDate, edited.month, edited.amountMinor]).toEqual([
          parent.bookDate,
          parent.month,
          10001,
        ]);
      });

      await test.step("a real date change PATCHes the new carrier; the child follows, cents stay", async () => {
        await expect(page.locator("#bookDate")).toHaveValue("31.10.2026");
        const save = page.getByRole("button", { name: /^\W*Speichern$/ });
        // the editor model is rebuilt from the reloaded list after the first PATCH; wait until it is clean again
        await expect(
          page
            .locator("table")
            .getByText("Dock parent edited", { exact: true }),
        ).toBeVisible();
        await expect(save).toBeDisabled();
        await page.waitForLoadState("networkidle");
        await page.locator("#bookDate").click();
        await page.locator(".p-datepicker-next-button").click();
        await page
          .locator(
            ".p-datepicker-day-view td:not(.p-datepicker-other-month) .p-datepicker-day",
          )
          .filter({ hasText: /^1$/ })
          .click();
        await expect(page.locator("#bookDate")).toHaveValue("01.11.2026");
        await expect(page.locator(".p-datepicker-day-view")).toHaveCount(0);
        await expect(save).toBeEnabled();
        const patched = page.waitForResponse(
          (r) =>
            r.url().endsWith(`/api/transactions/${parent._id}`) &&
            r.request().method() === "PATCH",
          { timeout: 30000 },
        );
        await save.click({ timeout: 30000 });
        const response = await patched;
        expect(response.status(), await response.text()).toBe(200);
        expect(patches).toHaveLength(2);
        expect(patches[1]!.body).toEqual({
          bookDate: "2026-11-01T00:00:00.000Z",
        });
        const moved = (await response.json()) as Tx;
        expect([moved.bookDate, moved.month, moved.amountMinor]).toEqual([
          "2026-11-01T00:00:00.000Z",
          "2026-11-01T00:00:00.000Z",
          10001,
        ]);
      });

      const stored = await getJson<{ items: Tx[] }>(
        page,
        user,
        `/api/transactions?accountId=${account._id}`,
      );
      const byTitle = new Map(
        [...stored.items, ...stored.items.flatMap((t) => t.children ?? [])].map(
          (t) => [t.title, t],
        ),
      );
      const storedParent = byTitle.get("Dock parent edited")!;
      const storedChild = byTitle.get("Dock child")!;
      expect(
        [storedParent.bookDate, storedParent.month, storedParent.amountMinor],
        "parent after the edit",
      ).toEqual([
        "2026-11-01T00:00:00.000Z",
        "2026-11-01T00:00:00.000Z",
        10001,
      ]);
      expect(
        [storedChild.bookDate, storedChild.month, storedChild.amountMinor],
        "split child cascaded with unchanged cents",
      ).toEqual(["2026-11-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z", 3333]);
      expect(byTitle.get("Dock direct")).toMatchObject({
        bookDate: `${localDay}T00:00:00.000Z`,
        amountMinor: 1234,
      });
      expect(byTitle.get("Dock queued")).toMatchObject({
        bookDate: `${localDay}T00:00:00.000Z`,
        amountMinor: 555,
      });
    });
  });
}
