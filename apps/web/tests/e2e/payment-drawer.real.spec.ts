import { DateTime } from "luxon";
import { MongoClient, ObjectId, BSON } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  BankDateSchema,
  bankDateToCarrier,
  currentMonthKey,
  monthKeyFromBankDate,
  monthKeyToAnchorIso,
} from "@tobu/contracts/calendar";
import { test, expect } from "./helpers/test-fixture";
import {
  registerRealUser,
  createRealAccount,
  postJson,
  getJson,
} from "./helpers/real-api";

test.use({ storageState: { cookies: [], origins: [] } });
for (const zone of [
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
]) {
  test.describe(`F-3 native payment click ${zone}`, () => {
    test.use({ timezoneId: zone });
    test("real pointer reaches submit and commits one exact payment and event", async ({
      page,
    }) => {
      const user = await registerRealUser(page, `F3 ${zone}`);
      const { account, others } = await createRealAccount(
        page,
        user,
        "F3 payment",
        ["F3 payer"],
      );
      const month = currentMonthKey("utc", DateTime.utc().toJSDate());
      await postJson(page, user, "/api/member-incomes", {
        accountId: account._id,
        memberId: others[0]!._id,
        amountMinor: 200000,
        fromMonth: month,
        toMonth: null,
      });
      await postJson(page, user, "/api/contribution-rules", {
        accountId: account._id,
        type: "additional",
        recurring: true,
        amountMinor: 5000,
        distribution: { mode: "proRataIncome" },
        fromMonth: month,
        toMonth: null,
      });
      const uri = process.env["TEST_MONGODB_URI"]!;
      const endpoint = new URL(uri);
      expect(["localhost", "127.0.0.1", "[::1]"]).toContain(endpoint.hostname);
      expect(endpoint.pathname).toMatch(/^\/tobu_test_[a-f0-9]{32}$/);
      const client = await new MongoClient(uri).connect();
      try {
        const db = client.db(),
          accountId = new ObjectId(account._id);
        const eventsBefore = await db
          .collection("events")
          .find({ accountId })
          .sort({ _id: 1 })
          .toArray();
        expect(
          await db.collection("transactions").countDocuments({ accountId }),
        ).toBe(0);
        await page.goto(`/accounts/${account._id}/month`);
        await page
          .getByRole("button", { name: /Einzahlung buchen/ })
          .nth(1)
          .click();
        const drawer = page.locator(".p-drawer:visible");
        const submit = drawer.getByRole("button", {
          name: /Einzahlung buchen$/,
        });
        await expect(submit).toBeEnabled();
        const localDay = BankDateSchema.parse(
          DateTime.utc().setZone(zone).toISODate(),
        );
        const output = resolve("../../test-results/e09");
        await mkdir(output, { recursive: true });
        try {
          // Trial uses normal hit-testing without a click or a forced/DOM submit.
          await submit.click({ trial: true, timeout: 3000 });
        } catch (error) {
          const hit = await submit.evaluate((button) => {
            const bounds = button.getBoundingClientRect();
            const target = document.elementFromPoint(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2,
            );
            return {
              targetTag: target?.tagName,
              targetClass: target?.className,
              reachesButton: target === button || button.contains(target),
              drawerParentClass:
                button.closest(".p-drawer")?.parentElement?.className,
            };
          });
          const after = await db
            .collection("events")
            .find({ accountId })
            .sort({ _id: 1 })
            .toArray();
          expect(BSON.serialize({ rows: after })).toEqual(
            BSON.serialize({ rows: eventsBefore }),
          );
          expect(
            await db.collection("transactions").countDocuments({ accountId }),
          ).toBe(0);
          await writeFile(
            resolve(output, `f3-${zone.replaceAll("/", "-")}-blocked.json`),
            JSON.stringify(
              {
                hit,
                eventCountBefore: eventsBefore.length,
                eventCountAfter: after.length,
                transactionCount: 0,
              },
              null,
              2,
            ),
          );
          await page.screenshot({
            path: resolve(
              output,
              `f3-${zone.replaceAll("/", "-")}-blocked.png`,
            ),
            fullPage: true,
          });
          throw error;
        }
        const [response] = await Promise.all([
          page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === "/api/transactions" &&
              r.request().method() === "POST" &&
              r.status() !== 428,
          ),
          submit.click(),
        ]);
        expect(response.status()).toBe(201);
        const payload = response.request().postDataJSON();
        expect(payload.month).toBeUndefined();
        expect(payload.bookDate).toBe(bankDateToCarrier(localDay));
        const payment = await response.json();
        expect(payment.amountMinor).toBe(5000);
        expect(payment.paidByMemberId).toBe(others[0]!._id);
        expect(payment.status).toBe("booked");
        expect(payment.bookDate).toBe(bankDateToCarrier(localDay));
        expect(payment.month).toBe(
          monthKeyToAnchorIso(monthKeyFromBankDate(localDay)),
        );
        await expect(drawer).toHaveCount(0);
        const transactions = await db
          .collection("transactions")
          .find({ accountId })
          .toArray();
        expect(transactions).toHaveLength(1);
        expect(
          transactions.reduce((sum, row) => sum + Number(row.amountMinor), 0),
        ).toBe(5000);
        const after = await db
          .collection("events")
          .find({ accountId })
          .toArray();
        expect(after).toHaveLength(eventsBefore.length + 1);
        const event = after.find(
          (row) =>
            row.code === "transaction.created" &&
            row.subject?.id === payment._id,
        )!;
        expect(event.actor).toEqual({ kind: "user", userId: user.userId });
        expect(event.params.amountMinor).toBe(5000);
        const model = await getJson<{ kpis: { totalPaidMinor: number } }>(
          page,
          user,
          `/api/accounts/${account._id}/month-view?month=${monthKeyFromBankDate(localDay)}`,
        );
        expect(model.kpis.totalPaidMinor).toBe(5000);
        await writeFile(
          resolve(output, `f3-${zone.replaceAll("/", "-")}-passed.json`),
          JSON.stringify(
            {
              bookDate: payment.bookDate,
              month: payment.month,
              amountMinor: payment.amountMinor,
              transactionCount: transactions.length,
              eventCountBefore: eventsBefore.length,
              eventCountAfter: after.length,
              actorUserId: event.actor.userId,
              payerMemberId: others[0]!._id,
            },
            null,
            2,
          ),
        );
      } finally {
        await client.close();
      }
    });
  });
}
