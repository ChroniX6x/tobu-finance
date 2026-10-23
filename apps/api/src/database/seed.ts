import { createHash } from "node:crypto";
import mongoose, { Types } from "mongoose";
import argon2 from "argon2";
import "./models.js";
import { verifyBaseline } from "./baseline.js";

export const DEMO_PASSWORD = "Tobu-Demo-2026!";
export const demoId = (key: string) => new Types.ObjectId(createHash("sha256").update(`tobu-demo-v1:${key}`).digest("hex").slice(0, 24));
export const demoUsers = ["admin", "admin-owner", "alice", "bob", "chris", "outsider", "new", "blocked"];
export async function seedDevelopment(requestedMonth?: string) {
  await verifyBaseline();
  const db = mongoose.connection.db!;
  const seeds = db.collection<{ name: string; month: string; status: string }>("_tobu_seed");
  const previous = await seeds.findOne({ name: "demo-v1" });
  const month = previous?.month ?? requestedMonth ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("SEED_MONTH must be YYYY-MM");
  if (previous && requestedMonth && requestedMonth !== previous.month) throw new Error("Seed reference month is fixed; use an explicit reset to change it");
  await seeds.updateOne({ name: "demo-v1" }, { $setOnInsert: { name: "demo-v1", month, status: "running" } }, { upsert: true });
  const date = (offset = 0, day = 1) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + offset, day));
  const member = (name: string) => demoId(`member:${name}`);
  const account = (name: string) => demoId(`account:${name}`);
  async function insert(modelName: string, key: string, values: Record<string, unknown>) {
    const model = mongoose.model(modelName);
    const id = demoId(key);
    if (await model.collection.findOne({ _id: id })) return;
    const doc = new model({ _id: id, ...values, createdAt: date(), updatedAt: date() });
    await doc.validate();
    // Bypass timestamps on updates: manual edits must remain byte-for-byte intact.
    await model.collection.updateOne({ _id: id }, { $setOnInsert: doc.toObject() }, { upsert: true });
  }
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  for (const name of demoUsers) {
    const email = `${name}@demo.tobu.test`;
    await insert("users", `user:${name}`, { email, emailNormalized: email, name: `Demo ${name}`, passwordHash,
      roles: name.startsWith("admin") ? ["user", "admin"] : ["user"], isActive: name !== "blocked" });
    if (!["admin", "new"].includes(name)) await insert("Member", `member:${name}`, { name: `Demo ${name}`, email, userId: demoId(`user:${name}`) });
  }
  const scenarios = [
    { key: "empty", name: "01 · Neues Konto (leer)", people: ["alice"] },
    { key: "solo", name: "02 · Einzelhaushalt", people: ["alice"] },
    { key: "household", name: "03 · Haushalt – Einkommen 2:1", people: ["alice", "bob", "admin-owner"] },
    { key: "zero", name: "04 · Drei Mitglieder ohne Einkommen", people: ["alice", "bob", "chris"] },
    { key: "custom", name: "05 · Aufteilung 60/40", people: ["alice", "bob"] },
    { key: "admin", name: "06 · Eigenes Konto des Admins", people: ["admin-owner"] },
    { key: "foreign", name: "07 · Fremdes Konto", people: ["outsider"] },
    { key: "blocked", name: "08 · Gesperrter Nutzer – Historie erhalten", people: ["blocked", "bob"] },
  ];
  for (const scenario of scenarios) {
    const aid = account(scenario.key);
    await insert("Account", `account:${scenario.key}`, { name: scenario.name, currency: "EUR", members: scenario.people.map((p, i) => ({ memberId: member(p), role: i === 0 ? "owner" : "member" })) });
    for (const category of ["food", "rent", "other"]) await insert("Category", `category:${scenario.key}:${category}`, { accountId: aid, name: { food: "Lebensmittel", rent: "Miete", other: "Sonstiges" }[category] });
    if (scenario.key === "empty") continue;
    for (const [i, person] of scenario.people.entries()) await insert("MemberIncome", `income:${scenario.key}:${person}`, {
      accountId: aid, memberId: member(person), amountMinor: scenario.key === "zero" ? 0 : i === 0 ? 200000 : i === 1 ? 100000 : 0, fromMonth: date(-6), source: "salary" });
    const distribution = scenario.key === "custom"
      ? { mode: "customSplit", customSplit: [{ memberId: member(scenario.people[0]!), split: 60 }, { memberId: member(scenario.people[1]!), split: 40 }] }
      : { mode: "proRataIncome" };
    await insert("ContributionRule", `rule:${scenario.key}`, { accountId: aid, type: "base", recurring: true, description: "Demo Grundbeitrag", amountMinor: ["custom", "zero"].includes(scenario.key) ? 10001 - Number(scenario.key === "zero") : 30000, distribution, fromMonth: date(-6) });
    for (let offset = -6; offset <= 0; offset++) {
      if (scenario.key === "custom" && [-2, -1, 0].includes(offset)) continue;
      await insert("AccountBalance", `balance:${scenario.key}:${offset}`, { accountId: aid, month: date(offset), closingBalanceMinor: 200000 + (offset + 6) * 15000 });
    }
    await insert("Transaction", `history:${scenario.key}`, { accountId: aid, title: "Historische Beispielausgabe", type: "expense", amountMinor: 2500, month: date(-3), bookDate: date(-3, 12), status: "booked", isFromSharedAccount: true });
  }
  const aid = account("household");
  const category = (key: string) => demoId(`category:household:${key}`);
  async function tx(key: string, amountMinor: number, extra: Record<string, unknown> = {}) {
    await insert("Transaction", `tx:${key}`, { accountId: aid, title: key, type: "expense", amountMinor, month: date(), bookDate: date(0, 10), status: "booked", isFromSharedAccount: true, ...extra });
  }
  await insert("CategoryBudget", "budget:food", { accountId: aid, categoryId: category("food"), amountMinor: 10000, fromMonth: date(-2) });
  for (const [offset, amount] of [[-2, 8000], [-1, 10000], [0, 12000]]) {
    await tx(`Budgetvergleich ${offset}`, amount!, { month: date(offset!), bookDate: date(offset!, 15), categoryId: category("food") });
  }
  await tx("Vollständiger Beitrag Alice", 20000, { type: "income", paidByMemberId: member("alice") });
  await tx("Teilbeitrag Bob", 5000, { type: "income", paidByMemberId: member("bob") });
  await tx("Vorgemerkt ohne Buchungsdatum", 3500, { status: "pending", bookDate: null, month: date(1) });
  await tx("Private Vorleistung", 1750, { isFromSharedAccount: false, paidByMemberId: member("bob") });
  for (const [key, parts] of [["Teilzuordnung", [3000, 2000]], ["Vollzuordnung", [6000, 4000]]] as const) {
    await tx(key, 10000);
    for (const [i, amount] of parts.entries()) await tx(`${key} Teil ${i + 1}`, amount, { parentTransactionId: demoId(`tx:${key}`), categoryId: category("other") });
  }
  for (let i = 1; i <= 65; i++) await tx(`Suche & Pagination ${String(i).padStart(2, "0")}`, 100 + i, { categoryId: category("other") });
  await insert("CarryOver", "carry:bob", { accountId: aid, memberId: member("bob"), month: date(), amountMinor: 2500, reason: "Demo Übertrag" });
  await insert("ContributionRule", "rule:individual:future", { accountId: aid, type: "additional", recurring: false, description: "Künftiger Einzelbeitrag", amountMinor: 12500, distribution: { mode: "perMember", memberId: member("bob") }, fromMonth: date(1), toMonth: date(1) });
  await insert("Recurrence", "recurrence:rent", { accountId: aid, categoryId: category("rent"), title: "Monatliche Miete", type: "expense", amountMinor: 90000, isFromSharedAccount: true, schedule: { freq: "monthly", dayOfMonth: 1 }, activeFrom: date(-6), nextPlanned: date(1), createdByMemberId: member("alice") });
  await seeds.updateOne({ name: "demo-v1" }, { $set: { status: "ready" } });
  console.log(`Demo v1 ready; fixed reference month ${month}. Accounts/password: docs/development.md`);
  return month;
}
