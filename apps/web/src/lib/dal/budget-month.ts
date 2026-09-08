import "server-only";

import {
  computeMonth,
  computeTargetProgress,
  monthOf,
  type BudgetInput,
  type CategoryTransactionInput,
  type MonthKey,
  type MonthResult,
  type Target,
  type TargetProgress,
} from "@budgie/budget";
import { unsafePence, type Pence } from "@budgie/core/money";
import { db, schema } from "@budgie/db";
import { eq, inArray } from "drizzle-orm";

import { requireBudget } from "@/lib/dal/budget";
import { listCategoryGroups, type CategoryGroupRow } from "@/lib/dal/categories";
import { listTargets } from "@/lib/dal/targets";

export type BudgetMonthGroup = Omit<CategoryGroupRow, "categories"> & {
  readonly categories: readonly (CategoryGroupRow["categories"][number] & {
    readonly assigned: number;
    readonly activity: number;
    readonly available: number;
    readonly target: Target | null;
    readonly targetProgress: TargetProgress | null;
  })[];
};

export type BudgetMonthView = {
  readonly month: MonthKey;
  readonly firstMonth: MonthKey;
  readonly readyToAssign: number;
  readonly groups: readonly BudgetMonthGroup[];
};

const toMonthKey = (isoDate: string): MonthKey => isoDate.slice(0, 7);

// The engine only ever sees home-currency pence - conversion happens here,
// at the data-loading boundary, so engine.ts stays currency-agnostic.
// exchangeRate is null for same-currency accounts (the common case).
const toHomePence = (amountPence: number, exchangeRate: string | null): Pence =>
  unsafePence(exchangeRate === null ? amountPence : Math.round(amountPence * Number(exchangeRate)));

export const loadBudgetInput = async (
  budgetId: string,
  firstMonth: MonthKey,
): Promise<BudgetInput> => {
  const [accounts, categories, transactions] = await Promise.all([
    db.query.account.findMany({ where: eq(schema.account.budgetId, budgetId) }),
    db.query.category.findMany({ where: eq(schema.category.budgetId, budgetId) }),
    db.query.transaction.findMany({ where: eq(schema.transaction.budgetId, budgetId) }),
  ]);

  const categoryIds = categories.map((category) => category.id);
  const transactionIds = transactions.map((transaction) => transaction.id);

  const [assignments, splits] = await Promise.all([
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
  ]);

  const categoryIdSet = new Set(categoryIds);
  const splitsByTransaction = new Map<string, typeof splits>();
  for (const split of splits) {
    const existing = splitsByTransaction.get(split.transactionId) ?? [];
    existing.push(split);
    splitsByTransaction.set(split.transactionId, existing);
  }

  const categoryTransactions: CategoryTransactionInput[] = [];
  for (const transaction of transactions) {
    if (transaction.categoryId && categoryIdSet.has(transaction.categoryId)) {
      categoryTransactions.push({
        kind: "category",
        id: transaction.id,
        accountId: transaction.accountId,
        date: transaction.date,
        entries: [
          {
            categoryId: transaction.categoryId,
            amountPence: toHomePence(transaction.amountPence, transaction.exchangeRate),
          },
        ],
      });
      continue;
    }

    const transactionSplits = splitsByTransaction.get(transaction.id);
    if (transactionSplits && transactionSplits.length > 0) {
      categoryTransactions.push({
        kind: "category",
        id: transaction.id,
        accountId: transaction.accountId,
        date: transaction.date,
        entries: transactionSplits
          .filter((split) => categoryIdSet.has(split.categoryId))
          .map((split) => ({
            categoryId: split.categoryId,
            amountPence: toHomePence(split.amountPence, transaction.exchangeRate),
          })),
      });
    }
    // A transaction with neither a category nor splits is a transfer (or
    // still uncategorised) - out of scope for the category engine.
  }

  return {
    firstMonth,
    accounts: accounts.map((account) => ({ id: account.id, onBudget: account.onBudget })),
    categories: categories.map((category) => ({
      id: category.id,
      role: category.isInflow
        ? { kind: "inflow" }
        : category.paymentForAccountId
          ? { kind: "payment", accountId: category.paymentForAccountId }
          : { kind: "normal" },
    })),
    assignments: assignments.map((assignment) => ({
      categoryId: assignment.categoryId,
      month: toMonthKey(assignment.month),
      assignedPence: unsafePence(assignment.assignedPence),
    })),
    transactions: categoryTransactions,
  };
};

export const getBudgetMonth = async (month: MonthKey): Promise<BudgetMonthView> => {
  const { budgetId, firstMonth } = await requireBudget();
  const budgetFirstMonth = toMonthKey(firstMonth);

  // Independent of each other - loading them together rather than the
  // category/target lookups only starting once the budget input has already
  // come back saves a full round trip on every budget-page render.
  const [input, groups, targets] = await Promise.all([
    loadBudgetInput(budgetId, budgetFirstMonth),
    listCategoryGroups(),
    listTargets(budgetId),
  ]);
  const result: MonthResult = computeMonth(input, month);

  const resultByCategory = new Map(result.categories.map((row) => [row.categoryId, row]));

  const view: BudgetMonthGroup[] = groups
    .filter((group) => !group.isSystem)
    .map((group) => ({
      id: group.id,
      name: group.name,
      sortOrder: group.sortOrder,
      hidden: group.hidden,
      isSystem: group.isSystem,
      categories: group.categories.map((category) => {
        const row = resultByCategory.get(category.id);
        const target = targets.get(category.id) ?? null;
        return {
          id: category.id,
          groupId: category.groupId,
          name: category.name,
          sortOrder: category.sortOrder,
          hidden: category.hidden,
          paymentForAccountId: category.paymentForAccountId,
          isInflow: category.isInflow,
          assigned: row?.assigned ?? 0,
          activity: row?.activity ?? 0,
          available: row?.available ?? 0,
          target,
          targetProgress: target && row ? computeTargetProgress(target, row, month) : null,
        };
      }),
    }));

  return {
    month,
    firstMonth: budgetFirstMonth,
    readyToAssign: result.readyToAssign,
    groups: view,
  };
};

export { monthOf };
