import { db } from "./client.ts";
import * as schema from "./schema/index.ts";
import { eq } from "drizzle-orm";

const SEED_USER_ID = "seed-user";
const SEED_BUDGET_NAME = "Seed Budget";

async function seed() {
  const existingUser = await db.query.user.findFirst({
    where: eq(schema.user.id, SEED_USER_ID),
  });

  if (!existingUser) {
    await db.insert(schema.user).values({
      id: SEED_USER_ID,
      name: "Seed User",
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

  const [inflow, ccPayment, groceries, transport, dining, rent, electricity] = await db
    .insert(schema.category)
    .values([
      {
        budgetId: budget.id,
        groupId: systemGroup.id,
        name: "Inflow: Ready to Assign",
        sortOrder: 0,
        isInflow: true,
      },
      {
        budgetId: budget.id,
        groupId: systemGroup.id,
        name: "Credit Card Payment",
        sortOrder: 1,
        paymentForAccountId: creditCard.id,
      },
      { budgetId: budget.id, groupId: everydayGroup.id, name: "Groceries", sortOrder: 0 },
      { budgetId: budget.id, groupId: everydayGroup.id, name: "Transport", sortOrder: 1 },
      { budgetId: budget.id, groupId: everydayGroup.id, name: "Dining Out", sortOrder: 2 },
      { budgetId: budget.id, groupId: billsGroup.id, name: "Rent", sortOrder: 0 },
      { budgetId: budget.id, groupId: billsGroup.id, name: "Electricity", sortOrder: 1 },
    ])
    .returning();
  if (!inflow || !ccPayment || !groceries || !transport || !dining || !rent || !electricity)
    throw new Error("Failed to insert categories");

  await db.insert(schema.categoryMonth).values([
    { categoryId: groceries.id, month: "2026-08-01", assignedPence: 30000 },
    { categoryId: transport.id, month: "2026-08-01", assignedPence: 10000 },
    { categoryId: dining.id, month: "2026-08-01", assignedPence: 5000 },
    { categoryId: rent.id, month: "2026-08-01", assignedPence: 90000 },
    { categoryId: electricity.id, month: "2026-08-01", assignedPence: 6000 },
  ]);

  const [supermarket, landlord, energyCo, employer, cafe] = await db
    .insert(schema.payee)
    .values([
      { budgetId: budget.id, name: "Supermarket" },
      { budgetId: budget.id, name: "Landlord" },
      { budgetId: budget.id, name: "Energy Co" },
      { budgetId: budget.id, name: "Employer" },
      { budgetId: budget.id, name: "Cafe" },
    ])
    .returning();
  if (!supermarket || !landlord || !energyCo || !employer || !cafe)
    throw new Error("Failed to insert payees");

  await db.insert(schema.transaction).values([
    {
      budgetId: budget.id,
      accountId: current.id,
      date: "2026-08-01",
      payeeId: employer.id,
      categoryId: inflow.id,
      amountPence: 250000,
      cleared: true,
    },
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
      accountId: current.id,
      date: "2026-08-11",
      payeeId: energyCo.id,
      categoryId: electricity.id,
      amountPence: -6000,
      cleared: false,
    },
    {
      // Credit card spending: moves 5,000 of the 5,000 assigned to Dining
      // Out into the payment category automatically - see @budgie/budget.
      budgetId: budget.id,
      accountId: creditCard.id,
      date: "2026-08-10",
      payeeId: cafe.id,
      categoryId: dining.id,
      amountPence: -3200,
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
