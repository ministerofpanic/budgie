import "server-only";

import {
  computeAgeOfMoney,
  computeIncomeVsExpenditure,
  computeNetWorthByMonth,
  computeSpendingByCategory,
  type IncomeVsExpenditure,
  type LedgerLine,
  type MonthKey,
  type NetWorthPoint,
} from "@budgie/budget";
import { unsafePence, type Pence } from "@budgie/core/money";
import { db, schema } from "@budgie/db";
import { eq, inArray } from "drizzle-orm";

import { requireBudget } from "@/lib/dal/budget";
import { listCategoryGroups } from "@/lib/dal/categories";
import { loadBudgetInput } from "@/lib/dal/budget-month";

// Reports read home-currency amounts throughout, same conversion boundary
// as loadBudgetInput - a foreign account's spending is reported at the
// rate captured on the transaction, not re-priced at today's spot rate.
const toHomePence = (amountPence: number, exchangeRate: string | null): Pence =>
  unsafePence(exchangeRate === null ? amountPence : Math.round(amountPence * Number(exchangeRate)));

/**
 * One ledger line per transaction, or per split for a split transaction -
 * the same decomposition `budget-month.ts` uses for the engine, so a report
 * total can never drift from what the budget grid and register show for the
 * same transactions.
 */
const loadLedgerLines = async (budgetId: string): Promise<readonly LedgerLine[]> => {
  const transactions = await db.query.transaction.findMany({
    where: eq(schema.transaction.budgetId, budgetId),
  });
  const transactionIds = transactions.map((transaction) => transaction.id);
  const splits =
    transactionIds.length > 0
      ? await db.query.transactionSplit.findMany({
          where: inArray(schema.transactionSplit.transactionId, transactionIds),
        })
      : [];

  const splitsByTransaction = new Map<string, typeof splits>();
  for (const split of splits) {
    const existing = splitsByTransaction.get(split.transactionId) ?? [];
    existing.push(split);
    splitsByTransaction.set(split.transactionId, existing);
  }

  const lines: LedgerLine[] = [];
  for (const transaction of transactions) {
    if (transaction.categoryId) {
      lines.push({
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        date: transaction.date,
        amountPence: toHomePence(transaction.amountPence, transaction.exchangeRate),
      });
      continue;
    }

    const transactionSplits = splitsByTransaction.get(transaction.id);
    if (transactionSplits && transactionSplits.length > 0) {
      for (const split of transactionSplits) {
        lines.push({
          accountId: transaction.accountId,
          categoryId: split.categoryId,
          date: transaction.date,
          amountPence: toHomePence(split.amountPence, transaction.exchangeRate),
        });
      }
      continue;
    }

    // Neither categorised nor split - a transfer, or not yet categorised.
    // Still counts toward account balances, just not toward any category.
    lines.push({
      accountId: transaction.accountId,
      categoryId: null,
      date: transaction.date,
      amountPence: toHomePence(transaction.amountPence, transaction.exchangeRate),
    });
  }
  return lines;
};

export type SpendingByCategoryRow = {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly spentPence: number;
  readonly incomePence: number;
};

export const getSpendingByCategory = async (
  from: string,
  to: string,
): Promise<readonly SpendingByCategoryRow[]> => {
  const { budgetId } = await requireBudget();
  const [lines, groups] = await Promise.all([loadLedgerLines(budgetId), listCategoryGroups()]);
  const categoryName = new Map(
    groups.flatMap((group) => group.categories).map((category) => [category.id, category.name]),
  );

  return computeSpendingByCategory(lines, from, to)
    .map((row) => ({
      categoryId: row.categoryId,
      categoryName: categoryName.get(row.categoryId) ?? "Unknown category",
      spentPence: row.spentPence,
      incomePence: row.incomePence,
    }))
    .toSorted((a, b) => b.spentPence - a.spentPence);
};

export const getIncomeVsExpenditure = async (
  from: string,
  to: string,
): Promise<IncomeVsExpenditure> => {
  const { budgetId } = await requireBudget();
  const lines = await loadLedgerLines(budgetId);
  return computeIncomeVsExpenditure(lines, from, to);
};

export const getNetWorthByMonth = async (
  months: readonly MonthKey[],
): Promise<readonly NetWorthPoint[]> => {
  const { budgetId } = await requireBudget();
  const lines = await loadLedgerLines(budgetId);
  return computeNetWorthByMonth(lines, months);
};

/**
 * How many days old is the money consumed by the most recent spending
 * transaction - always "as of now," unlike the other report functions'
 * date-range filters. Uses the engine's `BudgetInput` shape (via the same
 * loader `budget-month.ts` uses), not `loadLedgerLines` above - the
 * FIFO/credit-card logic needs `onBudget` and transfer-vs-category
 * distinctions `LedgerLine` doesn't carry.
 */
export const getAgeOfMoney = async (): Promise<number | null> => {
  const { budgetId, firstMonth } = await requireBudget();
  const input = await loadBudgetInput(budgetId, firstMonth.slice(0, 7));
  return computeAgeOfMoney(input);
};
