import "server-only";

import { db, schema } from "@budgie/db";
import { eq, inArray, sql } from "drizzle-orm";

import { requireBudget } from "@/lib/dal/budget";
import { listTargets } from "@/lib/dal/targets";

export type OfflineSnapshot = {
  readonly budgetId: string;
  readonly fetchedAt: string;
  readonly firstMonth: string;
  readonly homeCurrency: string;
  readonly accounts: readonly {
    readonly id: string;
    readonly name: string;
    readonly currency: string;
    readonly type: string;
    readonly onBudget: boolean;
    readonly closed: boolean;
  }[];
  readonly categoryGroups: readonly {
    readonly id: string;
    readonly name: string;
    readonly sortOrder: number;
    readonly hidden: boolean;
    readonly isSystem: boolean;
  }[];
  readonly categories: readonly {
    readonly id: string;
    readonly groupId: string;
    readonly name: string;
    readonly sortOrder: number;
    readonly hidden: boolean;
    readonly paymentForAccountId: string | null;
    readonly isInflow: boolean;
  }[];
  readonly assignments: readonly {
    readonly categoryId: string;
    readonly month: string;
    readonly assignedPence: number;
    readonly updatedAt: string;
  }[];
  readonly transactions: readonly {
    readonly id: string;
    readonly accountId: string;
    readonly date: string;
    readonly payeeId: string | null;
    readonly categoryId: string | null;
    readonly amountPence: number;
    readonly exchangeRate: string | null;
    readonly memo: string | null;
    readonly cleared: boolean;
    readonly reconciled: boolean;
    readonly runningBalancePence: number;
    readonly updatedAt: string;
  }[];
  readonly transactionSplits: readonly {
    readonly id: string;
    readonly transactionId: string;
    readonly categoryId: string;
    readonly amountPence: number;
    readonly memo: string | null;
  }[];
  readonly payees: readonly { readonly id: string; readonly name: string }[];
};

/**
 * A cheap "has anything changed" check - the offline client polls this on
 * every reconnect/foreground/5-minute-timer instead of unconditionally
 * re-pulling and re-persisting the whole budget snapshot each time. Two
 * indexed `max(updated_at)` scans, not a full-table read.
 */
export const getOfflineChangeSignature = async (): Promise<string> => {
  const { budgetId } = await requireBudget();

  const [[txn], [assignment]] = await Promise.all([
    db
      .select({ maxUpdatedAt: sql<string | null>`max(${schema.transaction.updatedAt})` })
      .from(schema.transaction)
      .where(eq(schema.transaction.budgetId, budgetId)),
    db
      .select({ maxUpdatedAt: sql<string | null>`max(${schema.categoryMonth.updatedAt})` })
      .from(schema.categoryMonth)
      .innerJoin(schema.category, eq(schema.categoryMonth.categoryId, schema.category.id))
      .where(eq(schema.category.budgetId, budgetId)),
  ]);

  return `${txn?.maxUpdatedAt ?? ""}|${assignment?.maxUpdatedAt ?? ""}`;
};

/**
 * Everything the offline client needs to mirror in IndexedDB: the whole
 * budget, unfiltered by month or account - the same "it all fits in
 * memory" assumption `loadBudgetInput` (budget-month.ts) already makes
 * server-side. Read-only; writes go through the normal Server Actions,
 * queued locally while offline and replayed on reconnect.
 */
export const getOfflineSnapshot = async (): Promise<OfflineSnapshot> => {
  const { budgetId, firstMonth, currency } = await requireBudget();

  const [accounts, categoryGroups, categories, transactions, payees] = await Promise.all([
    db.query.account.findMany({ where: eq(schema.account.budgetId, budgetId) }),
    db.query.categoryGroup.findMany({ where: eq(schema.categoryGroup.budgetId, budgetId) }),
    db.query.category.findMany({ where: eq(schema.category.budgetId, budgetId) }),
    db.query.transaction.findMany({ where: eq(schema.transaction.budgetId, budgetId) }),
    db.query.payee.findMany({ where: eq(schema.payee.budgetId, budgetId) }),
  ]);

  const categoryIds = categories.map((category) => category.id);
  const transactionIds = transactions.map((transaction) => transaction.id);

  const [assignments, transactionSplits, targets] = await Promise.all([
    categoryIds.length > 0
      ? db.query.categoryMonth.findMany({
          where: inArray(schema.categoryMonth.categoryId, categoryIds),
        })
      : [],
    transactionIds.length > 0
      ? db.query.transactionSplit.findMany({
          where: inArray(schema.transactionSplit.transactionId, transactionIds),
        })
      : [],
    listTargets(budgetId),
  ]);
  void targets; // targets aren't rendered in the offline views yet - fetched for parity, unused for now.

  return {
    budgetId,
    fetchedAt: new Date().toISOString(),
    firstMonth,
    homeCurrency: currency,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      type: account.type,
      onBudget: account.onBudget,
      closed: account.closed,
    })),
    categoryGroups: categoryGroups.map((group) => ({
      id: group.id,
      name: group.name,
      sortOrder: group.sortOrder,
      hidden: group.hidden,
      isSystem: group.isSystem,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      groupId: category.groupId,
      name: category.name,
      sortOrder: category.sortOrder,
      hidden: category.hidden,
      paymentForAccountId: category.paymentForAccountId,
      isInflow: category.isInflow,
    })),
    assignments: assignments.map((assignment) => ({
      categoryId: assignment.categoryId,
      month: assignment.month,
      assignedPence: assignment.assignedPence,
      updatedAt: assignment.updatedAt.toISOString(),
    })),
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      accountId: transaction.accountId,
      date: transaction.date,
      payeeId: transaction.payeeId,
      categoryId: transaction.categoryId,
      amountPence: transaction.amountPence,
      exchangeRate: transaction.exchangeRate,
      memo: transaction.memo,
      cleared: transaction.cleared,
      reconciled: transaction.reconciled,
      runningBalancePence: transaction.runningBalancePence,
      updatedAt: transaction.updatedAt.toISOString(),
    })),
    transactionSplits: transactionSplits.map((split) => ({
      id: split.id,
      transactionId: split.transactionId,
      categoryId: split.categoryId,
      amountPence: split.amountPence,
      memo: split.memo,
    })),
    payees: payees.map((payee) => ({ id: payee.id, name: payee.name })),
  };
};
