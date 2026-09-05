import "server-only";

import { db, schema } from "@budgie/db";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireBudget } from "@/lib/dal/budget";

export type AccountRow = {
  readonly id: string;
  readonly name: string;
  readonly type: (typeof schema.accountType.enumValues)[number];
  readonly onBudget: boolean;
  readonly closed: boolean;
};

export const listAccounts = async (): Promise<readonly AccountRow[]> => {
  const { budgetId } = await requireBudget();
  return db.query.account.findMany({
    where: and(eq(schema.account.budgetId, budgetId), eq(schema.account.closed, false)),
    orderBy: asc(schema.account.sortOrder),
  });
};

export const getAccount = async (accountId: string): Promise<AccountRow | undefined> => {
  const { budgetId } = await requireBudget();
  return db.query.account.findFirst({
    where: and(eq(schema.account.id, accountId), eq(schema.account.budgetId, budgetId)),
  });
};

const accountTypeSchema = z.enum(schema.accountType.enumValues);
const nameSchema = z.string().trim().min(1, "Name is required.").max(80);

/** Every budget gets its "Internal" system category group lazily, the first
 * time something needs to put a category in it - originally just Inflow,
 * now also a new credit account's payment category. */
const requireInternalGroup = async (budgetId: string) => {
  const existing = await db.query.categoryGroup.findFirst({
    where: and(
      eq(schema.categoryGroup.budgetId, budgetId),
      eq(schema.categoryGroup.isSystem, true),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(schema.categoryGroup)
    .values({ budgetId, name: "Internal", isSystem: true, sortOrder: 0 })
    .returning();
  if (!created) throw new Error("Failed to create system category group");
  return created;
};

/**
 * A credit account gets a payment category alongside it - the one YNAB-style
 * rule this engine leans on: spending on the card moves budgeted money into
 * that category rather than out of the category actually spent from.
 */
export const createAccount = async (rawName: string, rawType: unknown): Promise<AccountRow> => {
  const { budgetId } = await requireBudget("editor");
  const name = nameSchema.parse(rawName);
  const type = accountTypeSchema.parse(rawType);

  const existing = await db.query.account.findMany({
    where: eq(schema.account.budgetId, budgetId),
  });
  const sortOrder = Math.max(0, ...existing.map((account) => account.sortOrder)) + 1;

  const [account] = await db
    .insert(schema.account)
    .values({ budgetId, name, type, onBudget: type !== "tracking", sortOrder })
    .returning();
  if (!account) throw new Error("Failed to create account");

  if (type === "credit") {
    const internalGroup = await requireInternalGroup(budgetId);
    const siblingCategories = await db.query.category.findMany({
      where: eq(schema.category.groupId, internalGroup.id),
    });
    const categorySortOrder =
      Math.max(0, ...siblingCategories.map((category) => category.sortOrder)) + 1;
    await db.insert(schema.category).values({
      budgetId,
      groupId: internalGroup.id,
      name: `${name}: Payment`,
      sortOrder: categorySortOrder,
      paymentForAccountId: account.id,
    });
  }

  return account;
};

/** Closing hides the account from the active list and stops new transactions
 * against it, but keeps its history and any budget impact intact - the
 * default, reversible way to retire an account. */
export const closeAccount = async (rawAccountId: string): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const accountId = z.uuid().parse(rawAccountId);

  const account = await db.query.account.findFirst({
    where: and(eq(schema.account.id, accountId), eq(schema.account.budgetId, budgetId)),
  });
  if (!account) throw new Error(`No account ${accountId} in this budget`);

  await db
    .update(schema.account)
    .set({ closed: true, updatedAt: new Date() })
    .where(eq(schema.account.id, accountId));
};

/**
 * Permanently removes an account - only ever safe for one with zero
 * transactions, since there's nothing budget-relevant to lose. Every other
 * table that references the account (categories, payees, scheduled
 * transactions, bank connections) cascades on delete, so this is the one
 * place a hard delete is offered rather than the reversible close above.
 */
export const deleteAccount = async (rawAccountId: string): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const accountId = z.uuid().parse(rawAccountId);

  const account = await db.query.account.findFirst({
    where: and(eq(schema.account.id, accountId), eq(schema.account.budgetId, budgetId)),
  });
  if (!account) throw new Error(`No account ${accountId} in this budget`);

  const anyTransaction = await db.query.transaction.findFirst({
    where: eq(schema.transaction.accountId, accountId),
    columns: { id: true },
  });
  if (anyTransaction) {
    throw new Error("Only an account with no transactions can be permanently deleted.");
  }

  await db.delete(schema.account).where(eq(schema.account.id, accountId));
};
