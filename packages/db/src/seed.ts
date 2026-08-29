import { db } from "./client.ts";
import * as schema from "./schema/index.ts";
import { eq } from "drizzle-orm";

const SEED_USER_ID = "seed-user-mike";
const SEED_BUDGET_NAME = "Seed Budget";

async function seed() {
  const existingUser = await db.query.user.findFirst({
    where: eq(schema.user.id, SEED_USER_ID),
  });

  if (!existingUser) {
    await db.insert(schema.user).values({
      id: SEED_USER_ID,
      name: "Mike Holloway",
      email: "seed@budgie.test",
    });
  }

  const existingBudget = await db.query.budget.findFirst({
    where: eq(schema.budget.name, SEED_BUDGET_NAME),
  });

  if (existingBudget) {
    console.log("Seed budget already exists, skipping.");
    return;
  }

  const [budget] = await db
    .insert(schema.budget)
    .values({ name: SEED_BUDGET_NAME, currency: "GBP", firstMonth: "2026-08-01" })
    .returning();
  if (!budget) throw new Error("Failed to insert budget");

  await db.insert(schema.budgetMember).values({
    budgetId: budget.id,
    userId: SEED_USER_ID,
    role: "owner",
  });

  const [current, creditCard] = await db
    .insert(schema.account)
    .values([
      { budgetId: budget.id, name: "Current Account", type: "current", sortOrder: 0 },
      { budgetId: budget.id, name: "Credit Card", type: "credit", sortOrder: 1 },
    ])
    .returning();
  if (!current || !creditCard) throw new Error("Failed to insert accounts");

  const [systemGroup, everydayGroup, billsGroup] = await db
    .insert(schema.categoryGroup)
    .values([
      { budgetId: budget.id, name: "Internal", isSystem: true, sortOrder: 0 },
      { budgetId: budget.id, name: "Everyday", sortOrder: 1 },
      { budgetId: budget.id, name: "Bills", sortOrder: 2 },
    ])
    .returning();
  if (!systemGroup || !everydayGroup || !billsGroup) throw new Error("Failed to insert groups");

  const [ccPayment, groceries, transport, rent, electricity] = await db
    .insert(schema.category)
    .values([
      { budgetId: budget.id, groupId: systemGroup.id, name: "Credit Card Payment", sortOrder: 0 },
      { budgetId: budget.id, groupId: everydayGroup.id, name: "Groceries", sortOrder: 0 },
      { budgetId: budget.id, groupId: everydayGroup.id, name: "Transport", sortOrder: 1 },
      { budgetId: budget.id, groupId: billsGroup.id, name: "Rent", sortOrder: 0 },
      { budgetId: budget.id, groupId: billsGroup.id, name: "Electricity", sortOrder: 1 },
    ])
    .returning();
  if (!ccPayment || !groceries || !transport || !rent || !electricity)
    throw new Error("Failed to insert categories");

  await db.insert(schema.categoryMonth).values([
    { categoryId: groceries.id, month: "2026-08-01", assignedPence: 30000 },
    { categoryId: transport.id, month: "2026-08-01", assignedPence: 10000 },
    { categoryId: rent.id, month: "2026-08-01", assignedPence: 90000 },
    { categoryId: electricity.id, month: "2026-08-01", assignedPence: 6000 },
  ]);

  const [supermarket, landlord, energyCo] = await db
    .insert(schema.payee)
    .values([
      { budgetId: budget.id, name: "Supermarket" },
      { budgetId: budget.id, name: "Landlord" },
      { budgetId: budget.id, name: "Energy Co" },
    ])
    .returning();
  if (!supermarket || !landlord || !energyCo) throw new Error("Failed to insert payees");

  await db.insert(schema.transaction).values([
    {
      budgetId: budget.id,
      accountId: current.id,
      date: "2026-08-02",
      payeeId: landlord.id,
      categoryId: rent.id,
      amountPence: -90000,
      cleared: true,
    },
    {
      budgetId: budget.id,
      accountId: current.id,
      date: "2026-08-05",
      payeeId: supermarket.id,
      categoryId: groceries.id,
      amountPence: -4523,
      cleared: true,
    },
    {
      budgetId: budget.id,
      accountId: creditCard.id,
      date: "2026-08-10",
      payeeId: energyCo.id,
      categoryId: ccPayment.id,
      amountPence: -6000,
      cleared: false,
    },
  ]);

  console.log("Seed complete:", budget.id);
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
