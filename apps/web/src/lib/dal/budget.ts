import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { db, schema } from "@budgie/db";
import { eq, inArray } from "drizzle-orm";

import { requireSession } from "@/lib/session";

export type BudgetRole = "owner" | "editor" | "viewer";

export type BudgetContext = {
  readonly budgetId: string;
  readonly userId: string;
  readonly role: BudgetRole;
  readonly firstMonth: string;
  readonly currency: string;
};

const roleRank: Record<BudgetRole, number> = { viewer: 0, editor: 1, owner: 2 };

const ACTIVE_BUDGET_COOKIE = "budgetId";

const currentMonthStart = (): string => {
  const now = new Date();
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

/**
 * Every signed-in user gets exactly one budget of their own, created lazily
 * on first use so sign-up doesn't need a separate onboarding step. Sharing
 * (phase 08) adds further budgets via membership on top of this - a user's
 * own budget is never replaced by joining someone else's.
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

export type MembershipRow = {
  readonly budgetId: string;
  readonly budgetName: string;
  readonly role: BudgetRole;
};

/** Every budget the signed-in user belongs to, for a budget switcher - most
 * users have exactly one and never see it. */
export const listMemberships = async (): Promise<readonly MembershipRow[]> => {
  const session = await requireSession();
  const memberships = await db.query.budgetMember.findMany({
    where: eq(schema.budgetMember.userId, session.user.id),
  });
  if (memberships.length === 0) return [];

  const budgets = await db.query.budget.findMany({
    where: inArray(
      schema.budget.id,
      memberships.map((membership) => membership.budgetId),
    ),
  });
  const budgetsById = new Map(budgets.map((budget) => [budget.id, budget]));

  return memberships
    .map((membership) => {
      const budget = budgetsById.get(membership.budgetId);
      return budget
        ? { budgetId: budget.id, budgetName: budget.name, role: membership.role }
        : null;
    })
    .filter((row): row is MembershipRow => row !== null);
};

/** Switches the active budget for future requests - only onto a budget the
 * user actually belongs to, so a manipulated cookie value can't grant access
 * to a budget the caller isn't a member of. */
export const setActiveBudget = async (rawBudgetId: string): Promise<void> => {
  const session = await requireSession();
  const memberships = await db.query.budgetMember.findMany({
    where: eq(schema.budgetMember.userId, session.user.id),
  });
  if (!memberships.some((membership) => membership.budgetId === rawBudgetId)) {
    throw new Error("Not a member of that budget");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUDGET_COOKIE, rawBudgetId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
};

const resolveActiveMembership = async (userId: string) => {
  const memberships = await db.query.budgetMember.findMany({
    where: eq(schema.budgetMember.userId, userId),
  });
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BUDGET_COOKIE)?.value;
  const active = activeId ? memberships.find((m) => m.budgetId === activeId) : undefined;
  return active ?? memberships.find((m) => m.role === "owner") ?? memberships[0]!;
};

/**
 * The membership + budget-row resolution, cached per request regardless of
 * which `minRole` a caller asks `requireBudget` for - every DAL function
 * calls `requireBudget` independently, and without this every one of them
 * would repeat the same session, membership and budget lookups.
 */
const resolveBudgetContext = cache(async (): Promise<BudgetContext> => {
  const session = await requireSession();
  const userId = session.user.id;

  const membership = await resolveActiveMembership(userId);

  const { budgetId, role } = membership
    ? { budgetId: membership.budgetId, role: membership.role }
    : {
        budgetId: (await createDefaultBudget(userId, session.user.name)).id,
        role: "owner" as const,
      };

  const budget = await db.query.budget.findFirst({ where: eq(schema.budget.id, budgetId) });
  if (!budget) throw new Error(`No budget ${budgetId} found`);

  return { budgetId, userId, role, firstMonth: budget.firstMonth, currency: budget.currency };
});

/**
 * Resolves the signed-in user's active budget and membership role, creating
 * a budget on first use. Every other DAL function takes the resolved
 * `budgetId` as given rather than trusting one a caller supplies - the
 * membership lookup here is the one place that's ever established.
 *
 * Pass `minRole` to gate a mutation: a member with too low a role throws
 * rather than the caller silently trusting the UI to have hidden the button.
 */
export const requireBudget = async (minRole: BudgetRole = "viewer"): Promise<BudgetContext> => {
  const context = await resolveBudgetContext();

  if (roleRank[context.role] < roleRank[minRole]) {
    throw new Error(`This action needs ${minRole} access; you have ${context.role} access.`);
  }

  return context;
};
