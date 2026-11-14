import { MongoClient, ObjectId } from "mongodb";
import { test, expect } from "./helpers/test-fixture";
import {
  registerRealUser,
  createRealAccount,
  postJson,
  getJson,
} from "./helpers/real-api";
import type { ActivityPage } from "@tobu/contracts/activity";

test.use({ storageState: { cookies: [], origins: [] } });
for (const width of [1280, 390]) {
  test(`E06 real Activity desktop/mobile JWT paging, equal timestamps, deletion and ACL ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const user = await registerRealUser(page, `E06 reader ${width}`);
    const { account } = await createRealAccount(page, user, "Activity real");
    const category = await postJson<{ _id: string }>(
      page,
      user,
      "/api/categories",
      { accountId: account._id, name: "<script>window.e06xss=1</script>" },
    );
    // Explicit fixture access only to the test-stack's short-lived local Docker database.
    const uri = process.env["TEST_MONGODB_URI"];
    expect(uri).toBeTruthy();
    const parsed = new URL(uri!);
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(parsed.hostname);
    expect(parsed.pathname).toMatch(/^\/tobu_test_[a-f0-9]{32}$/);
    const client = new MongoClient(uri!);
    await client.connect();
    try {
      const db = client.db();
      const oid = new ObjectId(account._id);
      const receipt = await db.collection("events").findOne({
        accountId: oid,
        code: "category.created",
        "subject.id": category._id,
      });
      expect(receipt).toBeTruthy();
      // Real writer-generated receipt remains; copies model separately committed same-batch items, not a new engine.
      const docs = Array.from({ length: 25 }, (_, n) => ({
        ...receipt!,
        _id: new ObjectId(),
        commandId: `e06-${width}-${n}`,
        correlationId: `e06-${width}-${n}`,
        batchId: `e06-browser-${width}`,
        date: new Date("2026-11-08T12:00:00.000Z"),
      }));
      await db.collection("events").insertMany(docs);
      await db.collection("events").insertMany(
        [
          {
            ...receipt!,
            _id: new ObjectId(),
            actor: { kind: "system" },
            trigger: { kind: "automation", initiatedByUserId: user.userId },
            correlationId: `e06-system-${width}`,
            commandId: `e06-system-${width}`,
            date: new Date("2026-11-08T11:00:00.000Z"),
          },
          {
            _id: new ObjectId(),
            accountId: oid,
            code: "historical-unknown",
            params: { notes: "PRIVATE_NOTES" },
            createdByMemberId: new ObjectId(),
            date: new Date("2026-11-08T10:00:00.000Z"),
          },
        ],
        { bypassDocumentValidation: true },
      );
      await db
        .collection("categories")
        .deleteOne({ _id: new ObjectId(category._id), accountId: oid });
      const before = JSON.stringify(
        await db
          .collection("events")
          .find({ accountId: oid })
          .sort({ _id: 1 })
          .toArray(),
      );
      await page.goto(`/accounts/${account._id}/activity`);
      await expect(
        page.getByRole("heading", { name: "Kontoaktivitäten", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("status")).toContainText(
        "20 Ereignisse geladen",
      );
      await page
        .getByRole("button", { name: "Weitere Aktivitäten laden", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText(
        "29 Ereignisse geladen",
      );
      const summary = page
        .locator("summary")
        .filter({ hasText: "25 geladene" });
      await expect(summary).toBeVisible();
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.locator(".actor").filter({ hasText: "System" }),
      ).toBeVisible();
      await expect(
        page.locator(".actor").filter({ hasText: "Unbekannt" }),
      ).toBeVisible();
      await expect(
        page
          .locator(".actor")
          .filter({ hasText: "Activity real owner" })
          .first(),
      ).toBeVisible();
      await expect(page.locator(".activity")).not.toContainText(
        "PRIVATE_NOTES",
      );
      await expect(
        page
          .locator("[data-event-id]")
          .filter({ hasText: "gelöscht oder nicht mehr verfügbar" })
          .first()
          .locator("a"),
      ).toHaveCount(0);
      await expect(page.locator(".activity script, .activity img")).toHaveCount(
        0,
      );
      await expect(
        page
          .getByText("<script>window.e06xss=1</script>", { exact: false })
          .first(),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => (window as Window & { e06xss?: number }).e06xss,
        ),
      ).toBeUndefined();
      const api = await getJson<ActivityPage>(
        page,
        user,
        `/api/accounts/${account._id}/activity?limit=100`,
      );
      expect(new Set(api.items.map((e) => e.id)).size).toBe(29);
      expect(
        await db.collection("events").countDocuments({ accountId: oid }),
      ).toBe(29);
      expect(
        JSON.stringify(
          await db
            .collection("events")
            .find({ accountId: oid })
            .sort({ _id: 1 })
            .toArray(),
        ),
      ).toBe(before);
      await page
        .getByRole("combobox", { name: "Ereignisart", exact: true })
        .selectOption("category.created");
      await page.getByRole("button", { name: "Filter anwenden" }).click();
      await expect(page.getByRole("status")).toContainText(
        "20 Ereignisse geladen",
      );
      expect(
        await page
          .getByRole("form", { name: "Aktivitäten filtern" })
          .ariaSnapshot(),
      ).toContain('combobox "Ereignisart"');
      expect(
        await page
          .locator(".activity")
          .evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
      const stranger = await registerRealUser(page, `E06 outsider ${width}`);
      expect(
        (
          await page.request.get(`/api/accounts/${account._id}/activity`, {
            headers: stranger.headers,
          })
        ).status(),
      ).toBe(404);
      expect(
        (
          await page.request.get(`/api/accounts/${account._id}/overview`, {
            headers: stranger.headers,
          })
        ).status(),
      ).toBe(404);
      await page.reload();
      await expect(page.getByRole("alert")).toContainText("nicht verfügbar");
      await expect(page.locator("[data-event-id]")).toHaveCount(0);
    } finally {
      await client.close();
    }
  });
}
