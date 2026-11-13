import { MongoClient, ObjectId } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DateTime } from "luxon";
import { test, expect } from "./helpers/test-fixture";
import {
  registerRealUser,
  createRealAccount,
  postJson,
} from "./helpers/real-api";

test.use({
  storageState: { cookies: [], origins: [] },
  launchOptions: { args: ["--force-renderer-accessibility"] },
});

type AXNode = {
  ignored: boolean;
  role?: { value?: string };
  name?: { value?: string };
  properties?: { name: string; value: { value?: unknown } }[];
};
const property = (node: AXNode, name: string) =>
  node.properties?.find((entry) => entry.name === name)?.value.value;

for (const width of [1280, 390]) {
  test(`E08 real Chrome screenreader interface, keyboard, live status and access-loss recovery ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const user = await registerRealUser(page, `E08 accessibility ${width}`);
    const { account } = await createRealAccount(
      page,
      user,
      "E08 accessibility",
    );
    const category = await postJson<{ _id: string }>(
      page,
      user,
      "/api/categories",
      {
        accountId: account._id,
        name: "AX_SAFE_TITLE <script>window.e08xss=1</script>",
      },
    );
    const uri = process.env["TEST_MONGODB_URI"];
    expect(uri).toBeTruthy();
    const parsed = new URL(uri!);
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(parsed.hostname);
    expect(parsed.pathname).toMatch(/^\/tobu_test_[a-f0-9]{32}$/);
    const client = await new MongoClient(uri!).connect();
    const output = resolve("../../test-results/e08");
    await mkdir(output, { recursive: true });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Accessibility.enable");
    const capture = async (state: string) => {
      const tree = (await cdp.send("Accessibility.getFullAXTree")) as {
        nodes: AXNode[];
      };
      await writeFile(
        resolve(output, `ax-${width}-${state}.json`),
        JSON.stringify(tree, null, 2),
      );
      return tree.nodes.filter((node) => !node.ignored);
    };
    const assertStatus = (nodes: AXNode[], text: string, busy: boolean) => {
      const status = nodes.find((node) => node.role?.value === "status");
      expect(status).toBeTruthy();
      expect(property(status!, "live")).toBe("polite");
      expect(nodes.some((node) => node.name?.value?.includes(text))).toBe(true);
      const list = nodes.find(
        (node) =>
          node.role?.value === "list" &&
          node.name?.value === "Geladene Kontoaktivitäten",
      );
      expect(list).toBeTruthy();
      // The tested Chrome AX protocol encodes busy as boolean-typed numeric 1.
      // Accept only the two boolean encodings (and absent=false), not arbitrary truthy data.
      const value = property(list!, "busy");
      expect([undefined, false, true, 0, 1]).toContain(value);
      expect(value === true || value === 1).toBe(busy);
    };
    try {
      const db = client.db();
      const oid = new ObjectId(account._id);
      const original = await db.collection("accounts").findOne({ _id: oid });
      expect(original).toBeTruthy();
      const receipt = await db.collection("events").findOne({
        accountId: oid,
        code: "category.created",
        "subject.id": category._id,
      });
      expect(receipt).toBeTruthy();
      const batchDate = DateTime.fromJSDate(receipt!["date"] as Date, {
        zone: "utc",
      })
        .plus({ milliseconds: 1 })
        .toJSDate();
      // Read fixtures represent committed per-item events, not a recurrence domain or ensure implementation.
      await db.collection("events").insertMany(
        Array.from({ length: 25 }, (_, index) => ({
          ...receipt!,
          _id: new ObjectId(),
          commandId: `e08-ax-${width}-${index}`,
          correlationId: `e08-ax-${width}-${index}`,
          batchId: `e08-ax-${width}`,
          date: batchDate,
        })),
      );
      const snapshot = async () =>
        JSON.stringify(
          await Promise.all(
            ["accounts", "categories", "transactions", "events"].map(
              async (name) => [
                name,
                await db
                  .collection(name)
                  .find(name === "accounts" ? { _id: oid } : { accountId: oid })
                  .sort({ _id: 1 })
                  .toArray(),
              ],
            ),
          ),
        );
      const before = await snapshot();
      await writeFile(
        resolve(output, `ax-${width}-browser.json`),
        JSON.stringify(await cdp.send("Browser.getVersion"), null, 2),
      );
      await page.goto(
        `/accounts/${account._id}/activity?code=category.created`,
      );
      const status = page.getByRole("status");
      await expect(status).toContainText("20 Ereignisse geladen");
      const initial = await capture("collapsed");
      for (const name of [
        "Ereignisart",
        "Akteur",
        "Objektart",
        "Ereignisse pro Seite",
      ])
        expect(
          initial.some(
            (node) =>
              node.role?.value === "combobox" && node.name?.value === name,
          ),
          name,
        ).toBe(true);
      expect(
        initial.some(
          (node) =>
            node.role?.value === "textbox" && node.name?.value === "Objekt-ID",
        ),
      ).toBe(true);
      for (const name of ["Von (einschließlich)", "Bis (ausschließlich)"])
        expect(
          initial.some((node) => node.name?.value === name),
          name,
        ).toBe(true);
      assertStatus(initial, "20 Ereignisse geladen", false);
      const disclosure = (nodes: AXNode[]) =>
        nodes.find(
          (node) =>
            node.name?.value?.includes("geladene Ereignisse einer Aktion") &&
            node.role?.value === "DisclosureTriangle",
        );
      expect(property(disclosure(initial)!, "expanded")).toBe(false);
      const summary = page
        .locator("summary")
        .filter({ hasText: "20 geladene" });
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(summary).toBeFocused();
      const expanded = await capture("expanded");
      expect(property(disclosure(expanded)!, "expanded")).toBe(true);
      expect(
        expanded.some((node) =>
          node.name?.value?.includes("Dies ist keine Gesamterfolgsmeldung"),
        ),
      ).toBe(true);
      expect(
        expanded.some((node) => node.name?.value?.includes("AX_SAFE_TITLE")),
      ).toBe(true);
      await page.keyboard.press("Enter");
      const more = page.getByRole("button", {
        name: "Weitere Aktivitäten laden",
        exact: true,
      });
      // Hold one real API request solely to inspect the actual loading AX state; no response is mocked.
      let release!: () => void;
      const gate = new Promise<void>((done) => {
        release = done;
      });
      const pattern = `**/api/accounts/${account._id}/activity?**`;
      await page.route(pattern, async (route) => {
        await gate;
        await route.continue();
      });
      try {
        await more.focus();
        await page.keyboard.press("Enter");
        await expect(status).toContainText("Aktivitäten werden geladen");
        assertStatus(
          await capture("loading"),
          "Aktivitäten werden geladen",
          true,
        );
      } finally {
        release();
      }
      await expect(status).toContainText("26 Ereignisse geladen");
      await expect(status).toBeFocused();
      const loaded = await capture("paged");
      assertStatus(loaded, "26 Ereignisse geladen", false);
      expect(
        property(
          loaded.find((node) => node.role?.value === "status")!,
          "focused",
        ),
      ).toBe(true);
      await page.unroute(pattern);
      const code = page.getByRole("combobox", {
        name: "Ereignisart",
        exact: true,
      });
      await code.selectOption("recurrence.created");
      const apply = page.getByRole("button", {
        name: "Filter anwenden",
        exact: true,
      });
      await apply.focus();
      await page.keyboard.press("Enter");
      await expect(status).toContainText("0 Ereignisse geladen");
      assertStatus(
        await capture("empty-filter"),
        "0 Ereignisse geladen",
        false,
      );
      await page
        .getByRole("button", { name: "Zurücksetzen", exact: true })
        .click();
      await expect(status).toContainText("20 Ereignisse geladen");
      // Actual membership revocation produces a real 404 while the page remains open.
      await db
        .collection("accounts")
        .updateOne({ _id: oid }, { $set: { members: [] } });
      await page
        .getByRole("button", { name: "Weitere Aktivitäten laden", exact: true })
        .click();
      const alert = page.getByRole("alert");
      await expect(alert).toContainText("nicht verfügbar");
      await expect(page.locator("[data-event-id]")).toHaveCount(0);
      const denied = await capture("access-denied");
      expect(denied.some((node) => node.role?.value === "alert")).toBe(true);
      expect(
        denied.some((node) => node.name?.value?.includes("AX_SAFE_TITLE")),
      ).toBe(false);
      expect(
        denied.some(
          (node) =>
            node.role?.value === "button" &&
            node.name?.value === "Erneut versuchen",
        ),
      ).toBe(true);
      await db
        .collection("accounts")
        .updateOne({ _id: oid }, { $set: { members: original!["members"] } });
      const retry = page.getByRole("button", {
        name: "Erneut versuchen",
        exact: true,
      });
      await retry.focus();
      await page.keyboard.press("Enter");
      await expect(status).toContainText("20 Ereignisse geladen");
      await expect(alert).toHaveCount(0);
      await code.focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("combobox", { name: "Akteur", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("combobox", { name: "Objektart", exact: true }),
      ).toBeFocused();
      await capture("recovered");
      expect(
        await page
          .locator(".activity")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      await expect(page.locator(".activity script")).toHaveCount(0);
      expect(await snapshot()).toBe(before);
      await page.screenshot({
        path: resolve(output, `activity-accessibility-${width}.png`),
        fullPage: true,
      });
    } finally {
      await cdp.detach();
      await client.close();
    }
  });
}
