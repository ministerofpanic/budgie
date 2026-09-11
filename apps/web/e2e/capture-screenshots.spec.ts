import { test, type CDPSession, type Page } from "@playwright/test";
import { db, schema } from "@budgie/db";
import { eq } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const addVirtualAuthenticator = async (page: Page): Promise<CDPSession> => {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return client;
};

const OUT_DIR = path.resolve(currentDir, "../../../promo-video/public/screens");

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test("capture real UI screenshots for the sizzle reel", async ({ page }) => {
  test.setTimeout(120_000);
  await addVirtualAuthenticator(page);
  const email = `sizzle-${Date.now()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Alex Morgan");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await page.waitForURL(/\/account\/passkeys/);

  // Populate realistic demo data directly - a fresh sign-up only gets an
  // empty default budget (one account, an Inflow category).
  const user = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
  if (!user) throw new Error("seed user not found");
  const membership = await db.query.budgetMember.findFirst({
    where: eq(schema.budgetMember.userId, user.id),
  });
  if (!membership) throw new Error("no budget membership");
  const budgetId = membership.budgetId;

  await db
    .update(schema.budget)
    .set({ firstMonth: "2026-08-01" })
    .where(eq(schema.budget.id, budgetId));

  const [current, savings, creditCard] = await db
    .insert(schema.account)
    .values([
      { budgetId, name: "Everyday", type: "current", currency: "GBP", sortOrder: 1 },
      { budgetId, name: "Joint Savings", type: "savings", currency: "GBP", sortOrder: 2 },
      { budgetId, name: "Barclaycard", type: "credit", currency: "GBP", sortOrder: 3 },
    ])
    .returning();
  if (!current || !savings || !creditCard) throw new Error("accounts failed");

  const internalGroup = await db.query.categoryGroup.findFirst({
    where: eq(schema.categoryGroup.budgetId, budgetId),
  });
  if (!internalGroup) throw new Error("no internal group");
  const inflowCategory = await db.query.category.findFirst({
    where: eq(schema.category.groupId, internalGroup.id),
  });

  await db.insert(schema.category).values({
    budgetId,
    groupId: internalGroup.id,
    name: "Barclaycard: Payment",
    sortOrder: 2,
    paymentForAccountId: creditCard.id,
  });

  const [everydayGroup, billsGroup, funGroup] = await db
    .insert(schema.categoryGroup)
    .values([
      { budgetId, name: "Everyday", sortOrder: 1 },
      { budgetId, name: "Bills", sortOrder: 2 },
      { budgetId, name: "Fun", sortOrder: 3 },
    ])
    .returning();
  if (!everydayGroup || !billsGroup || !funGroup) throw new Error("groups failed");

  const [groceries, transport, rent, electricity, subscriptions, dining, coffee] = await db
    .insert(schema.category)
    .values([
      { budgetId, groupId: everydayGroup.id, name: "Groceries", sortOrder: 0 },
      { budgetId, groupId: everydayGroup.id, name: "Transport", sortOrder: 1 },
      { budgetId, groupId: billsGroup.id, name: "Rent", sortOrder: 0 },
      { budgetId, groupId: billsGroup.id, name: "Electricity", sortOrder: 1 },
      { budgetId, groupId: billsGroup.id, name: "Subscriptions", sortOrder: 2 },
      { budgetId, groupId: funGroup.id, name: "Dining Out", sortOrder: 0 },
      { budgetId, groupId: funGroup.id, name: "Coffee", sortOrder: 1 },
    ])
    .returning();
  if (!groceries || !transport || !rent || !electricity || !subscriptions || !dining || !coffee)
    throw new Error("categories failed");

  await db.insert(schema.categoryMonth).values([
    { categoryId: groceries.id, month: "2026-09-01", assignedPence: 38000 },
    { categoryId: transport.id, month: "2026-09-01", assignedPence: 12000 },
    { categoryId: rent.id, month: "2026-09-01", assignedPence: 95000 },
    { categoryId: electricity.id, month: "2026-09-01", assignedPence: 7000 },
    { categoryId: subscriptions.id, month: "2026-09-01", assignedPence: 2500 },
    { categoryId: dining.id, month: "2026-09-01", assignedPence: 8000 },
    { categoryId: coffee.id, month: "2026-09-01", assignedPence: 3000 },
  ]);

  const [tesco, trainline, landlord, netflix, pret, octopus, employer, costa] = await db
    .insert(schema.payee)
    .values([
      { budgetId, name: "Tesco" },
      { budgetId, name: "Trainline" },
      { budgetId, name: "Landlord Ltd" },
      { budgetId, name: "Netflix" },
      { budgetId, name: "Pret A Manger" },
      { budgetId, name: "Octopus Energy" },
      { budgetId, name: "Employer Payroll" },
      { budgetId, name: "Costa Coffee" },
    ])
    .returning();
  if (!tesco || !trainline || !landlord || !netflix || !pret || !octopus || !employer || !costa)
    throw new Error("payees failed");

  await db.insert(schema.transaction).values([
    {
      budgetId,
      accountId: current.id,
      date: "2026-09-01",
      payeeId: employer.id,
      categoryId: inflowCategory?.id,
      amountPence: 285000,
      cleared: true,
      reconciled: false,
    },
    {
      budgetId,
      accountId: current.id,
      date: "2026-09-02",
      payeeId: landlord.id,
      categoryId: rent.id,
      amountPence: -95000,
      cleared: true,
    },
    {
      budgetId,
      accountId: current.id,
      date: "2026-09-04",
      payeeId: tesco.id,
      categoryId: groceries.id,
      amountPence: -6234,
      cleared: true,
    },
    {
      budgetId,
      accountId: current.id,
      date: "2026-09-05",
      payeeId: octopus.id,
      categoryId: electricity.id,
      amountPence: -5820,
      cleared: true,
    },
    {
      budgetId,
      accountId: current.id,
      date: "2026-09-06",
      payeeId: trainline.id,
      categoryId: transport.id,
      amountPence: -3450,
      cleared: true,
    },
    {
      budgetId,
      accountId: current.id,
      date: "2026-09-07",
      payeeId: tesco.id,
      categoryId: groceries.id,
      amountPence: -2891,
      cleared: false,
    },
    {
      budgetId,
      accountId: creditCard.id,
      date: "2026-09-07",
      payeeId: pret.id,
      categoryId: dining.id,
      amountPence: -1450,
      cleared: true,
    },
    {
      budgetId,
      accountId: creditCard.id,
      date: "2026-09-08",
      payeeId: netflix.id,
      categoryId: subscriptions.id,
      amountPence: -999,
      cleared: true,
    },
    {
      budgetId,
      accountId: creditCard.id,
      date: "2026-09-09",
      payeeId: costa.id,
      categoryId: coffee.id,
      amountPence: -395,
      cleared: false,
    },
    {
      budgetId,
      accountId: savings.id,
      date: "2026-09-03",
      payeeId: null,
      categoryId: null,
      amountPence: 20000,
      cleared: true,
    },
  ]);

  await db.execute(
    `UPDATE "transaction" t SET running_balance_pence = sub.balance FROM (SELECT id, SUM(amount_pence) OVER (PARTITION BY account_id ORDER BY date, id) AS balance FROM "transaction" WHERE budget_id = '${budgetId}') sub WHERE t.id = sub.id`,
  );

  // --- Screenshots ---
  await page.goto("/budget");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, "budget-grid.png") });

  await page.goto(`/accounts/${current.id}`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, "register.png") });

  await page.goto("/reports");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, "reports.png") });

  await page.goto(`/accounts/${creditCard.id}`);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Accounts" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "accounts-menu.png") });
  await page.keyboard.press("Escape");

  await page.goto("/sign-in");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "sign-in.png") });
});
