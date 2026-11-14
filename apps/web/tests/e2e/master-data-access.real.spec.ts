import { MongoClient, ObjectId } from "mongodb";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "./helpers/test-fixture";
import {
  registerRealUser,
  createRealAccount,
  postJson,
} from "./helpers/real-api";

test.use({ storageState: { cookies: [], origins: [] } });
for (const role of ["owner", "member"] as const) {
  test(`P02 real master data ${role}: rendered actions, server policy and category create`, async ({
    page,
  }) => {
    const user = await registerRealUser(page, `P02 ${role}`);
    const { account } = await createRealAccount(page, user, `P02 ${role}`);
    const uri = new URL(process.env["TEST_MONGODB_URI"]!);
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(uri.hostname);
    expect(uri.pathname).toMatch(/^\/tobu_test_[a-f0-9]{32}$/);
    const client = await new MongoClient(uri.toString()).connect();
    try {
      const db = client.db();
      if (role === "member") {
        const ownerPage = await page
          .context()
          .browser()!
          .newPage({ storageState: { cookies: [], origins: [] } });
        let ownerMember: { _id: string };
        try {
          const otherOwner = await registerRealUser(
            ownerPage,
            "P02 other owner",
          );
          ownerMember = await postJson(ownerPage, otherOwner, "/api/members", {
            name: "Other registered owner",
            userId: otherOwner.userId,
          });
        } finally {
          await ownerPage.close();
        }
        await db.collection("accounts").updateOne(
          { _id: new ObjectId(account._id) },
          {
            $set: { "members.0.role": "member" },
            $push: {
              members: {
                memberId: new ObjectId(ownerMember._id),
                role: "owner",
              },
            },
          },
        );
      }
      const master = page.waitForResponse(
        (response) => response.url().endsWith("/master-data") && response.ok(),
      );
      await page.goto(`/accounts/${account._id}/manage/master-data`);
      expect((await (await master).json()).account.callerRole).toBe(role);
      const section = page.locator("tbf-account-master-section");
      if (role === "owner") {
        await section.getByRole("button", { name: /Bearbeiten$/ }).click();
        const input = section.locator("input").first();
        await input.fill("P02 renamed");
        const saved = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
              `/api/accounts/${account._id}` &&
            response.request().method() === "PATCH" &&
            response.status() !== 428,
        );
        await section.getByRole("button", { name: /Speichern$/ }).click();
        expect((await saved).status()).toBe(200);
        await expect(
          section.getByText("P02 renamed", { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: /Mitglied hinzufügen$/ })
          .click();
        await expect(page.locator("#mem-name")).toBeVisible();
        await expect(page.getByRole("combobox")).toBeVisible();
        await page.getByRole("button", { name: /Abbrechen$/ }).click();
      } else {
        await expect(
          section.getByRole("button", { name: /Bearbeiten$/ }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: /Mitglied hinzufügen$/,
          }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: /Mitglied bearbeiten$/,
          }),
        ).toHaveCount(0);
        const snapshot = async () =>
          JSON.stringify(
            await Promise.all(
              ["accounts", "members", "categories", "events"].map(
                async (name) => [
                  name,
                  await db.collection(name).find().sort({ _id: 1 }).toArray(),
                ],
              ),
            ),
          );
        const before = await snapshot();
        const denied = await page.request.patch(
          `/api/accounts/${account._id}`,
          { headers: user.headers, data: { name: "forbidden" } },
        );
        expect(denied.status()).toBe(403);
        expect(await snapshot()).toBe(before);
      }
      await page.getByRole("button", { name: /Kategorie hinzufügen$/ }).click();
      await page.locator("#cat-name").fill(`P02 ${role} category`);
      const category = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/categories" &&
          response.status() === 201,
      );
      await page.getByRole("button", { name: /Hinzufügen$/ }).click();
      await category;
      await expect(
        page.getByText(`P02 ${role} category`, { exact: true }),
      ).toBeVisible();
      const output = resolve("../../docs/agents/runs/P02-evidence");
      await mkdir(output, { recursive: true });
      await page.screenshot({
        path: resolve(output, `master-data-${role}.png`),
        fullPage: true,
      });
    } finally {
      await client.close();
    }
  });
}
