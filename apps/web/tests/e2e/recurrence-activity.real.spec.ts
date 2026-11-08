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

test("E07 real read contract fixture cannot alias a still-live legacy recurrence; not a recurrence-domain delete", async ({
  page,
}) => {
  const user = await registerRealUser(page, "E07 read contract");
  const { account } = await createRealAccount(page, user, "E07 read");
  const legacy = await postJson<{ _id: string }>(
    page,
    user,
    "/api/recurrences",
    {
      accountId: account._id,
      title: "LEGACY_ONLY_TITLE",
      type: "expense",
      amountMinor: 1234,
      activeFrom: "2026-11",
    },
  );
  const uri = process.env["TEST_MONGODB_URI"];
  expect(uri).toBeTruthy();
  const url = new URL(uri!);
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
  expect(url.pathname).toMatch(/^\/tobu_test_[a-f0-9]{32}$/);
  const client = await new MongoClient(uri!).connect();
  try {
    const db = client.db(),
      eventId = new ObjectId();
    await db.collection("events").insertOne({
      _id: eventId,
      accountId: new ObjectId(account._id),
      date: new Date("2026-11-08T12:00:00.000Z"),
      schemaVersion: 1,
      code: "recurrence.deleted",
      actor: { kind: "user", userId: user.userId },
      trigger: { kind: "user_action" },
      subject: { kind: "recurrence", id: legacy._id },
      params: { recurrenceId: legacy._id },
    });
    const before = JSON.stringify(
      await db
        .collection("events")
        .find({ accountId: new ObjectId(account._id) })
        .sort({ _id: 1 })
        .toArray(),
    );
    const data = await getJson<ActivityPage>(
      page,
      user,
      `/api/accounts/${account._id}/activity?code=recurrence.deleted`,
    );
    expect(data.items).toHaveLength(1);
    expect(data.items[0].subject).toBeNull();
    expect(data.items[0].params).toBeNull();
    expect(data.items[0].detailsUnavailable).toBe(true);
    await page.goto(
      `/accounts/${account._id}/activity?code=recurrence.deleted`,
    );
    const entry = page.locator(`[data-event-id="${eventId}"]`);
    await expect(entry).toContainText(
      "Buchungsvorlage gelöscht – Details nicht verfügbar",
    );
    await expect(entry.locator("a")).toHaveCount(0);
    await expect(entry).not.toContainText("LEGACY_ONLY_TITLE");
    expect(
      await db
        .collection("recurrences")
        .countDocuments({ _id: new ObjectId(legacy._id) }),
      "read fixture did not delete or reinterpret the legacy domain",
    ).toBe(1);
    expect(
      JSON.stringify(
        await db
          .collection("events")
          .find({ accountId: new ObjectId(account._id) })
          .sort({ _id: 1 })
          .toArray(),
      ),
    ).toBe(before);
  } finally {
    await client.close();
  }
});
