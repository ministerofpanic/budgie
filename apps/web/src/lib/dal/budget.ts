import "server-only";

import { db, schema } from "@budgie/db";
import { eq } from "drizzle-orm";

import { requireSession } from "@/lib/session";

export type BudgetContext = {
  readonly budgetId: string;
  readonly userId: string;
  readonly role: "owner" | "editor" | "viewer";
  readonly firstMonth: string;
  readonly currency: string;
};

const currentMonthStart = (): string => {
  const now = new Date();
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

/**
 * Every signed-in user gets exactly one budget of their own - sharing
 * (phase 08) will extend this rather than replace it. Creating it lazily,
 * on first use, means sign-up doesn't need a separate onboarding step.
 */
const createDefaultBudget = async (userId: string, userName: string) => {
  const [budget] = await db
    .insert(schema.budget)
    .values({ name: `${userName}'s Budget`, currency: "GBP", firstMonth: currentMonthStart() })
    .returning();
  if (!budget) throw new Error("Failed to create budget");

  await db.insert(schema.budgetMember).values({ budgetId: budget.id, userId, role: "owner" });

  const [current] = await db
    .insert(schema.account)
    .values({ budgetId: budget.id, name: "Current Account", type: "current", sortOrder: 0 })
    .returning();
  if (!current) throw new Error("Failed to create default account");

  const [systemGroup] = await db
    .insert(schema.categoryGroup)
    .values({ budgetId: budget.id, name: "Internal", isSystem: true, sortOrder: 0 })
    .returning();
  if (!systemGroup) throw new Error("Failed to create system category group");

  await db.insert(schema.category).values({
    budgetId: budget.id,
    groupId: systemGroup.id,
    name: "Inflow: Ready to Assign",
    sortOrder: 0,
    isInflow: true,
  });

  return budget;
};

/**
 * Resolves the signed-in user's budget, creating one on first use. This is
 * the one place membership is established - every other DAL function takes
 * it as given rather than trusting a budgetId a caller supplies.
 */
export const requireBudget = async (): Promise<BudgetContext> => {
  const session = await requireSession();
  const userId = session.user.id;

  const membership = await db.query.budgetMember.findFirst({
    where: eq(schema.budgetMember.userId, userId),
  });

  if (membership) {
    const budget = await db.query.budget.findFirst({
      where: eq(schema.budget.id, membership.budgetId),
    });
    if (!budget) throw new Error(`budget_member ${membership.id} references a missing budget`);
    return {
      budgetId: budget.id,
      userId,
      role: membership.role,
      firstMonth: budget.firstMonth,
      currency: budget.currency,
    };
  }

  const budget = await createDefaultBudget(userId, session.user.name);
  return {
    budgetId: budget.id,
    userId,
    role: "owner",
    firstMonth: budget.firstMonth,
    currency: budget.currency,
  };
};
