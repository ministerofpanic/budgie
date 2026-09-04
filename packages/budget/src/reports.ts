/**
 * Reports are pure aggregations over the same lines the ledger itself is
 * built from - one line per (transaction or split) leg, exactly as it hits an
 * account and, where relevant, a category. Nothing here re-derives amounts:
 * a report total is always a sum of `amountPence` values taken straight from
 * the ledger, so a report can never disagree with the transactions it claims
 * to summarise.
 */
import {
  add,
  isNegative,
  isPositive,
  negate,
  subtract,
  sum,
  ZERO,
  type Pence,
} from "@budgie/core/money";
import { compareMonths, monthOf, type MonthKey } from "./month";
import type { AccountId, CategoryId } from "./types";

/** One leg of one transaction: an amount that hit a single account, and - if
 * the transaction was categorised - a single category. A split transaction
 * contributes one line per split; an uncategorised or transfer transaction
 * contributes one line with `categoryId: null`. */
export type LedgerLine = {
  readonly accountId: AccountId;
  readonly categoryId: CategoryId | null;
  readonly date: string;
  readonly amountPence: Pence;
};

const inPeriod = (date: string, from: string, to: string): boolean => date >= from && date <= to;

export type CategoryPeriodTotal = {
  readonly categoryId: CategoryId;
  /** Money that moved out of the category - always non-negative. */
  readonly spentPence: Pence;
  /** Money that moved in (refunds, income categorised here) - always non-negative. */
  readonly incomePence: Pence;
};

/** Spending (and income) by category, for lines dated within `from`..`to`
 * inclusive. Lines with no category - transfers, and anything not yet
 * categorised - are outside a category breakdown by definition and excluded. */
export const computeSpendingByCategory = (
  lines: readonly LedgerLine[],
  from: string,
  to: string,
): readonly CategoryPeriodTotal[] => {
  const totals = new Map<CategoryId, { spent: Pence; income: Pence }>();
  for (const line of lines) {
    if (line.categoryId === null || !inPeriod(line.date, from, to)) continue;
    const current = totals.get(line.categoryId) ?? { spent: ZERO, income: ZERO };
    if (isNegative(line.amountPence)) {
      current.spent = add(current.spent, negate(line.amountPence));
    } else if (isPositive(line.amountPence)) {
      current.income = add(current.income, line.amountPence);
    }
    totals.set(line.categoryId, current);
  }
  return Array.from(totals, ([categoryId, { spent, income }]) => ({
    categoryId,
    spentPence: spent,
    incomePence: income,
  }));
};

export type IncomeVsExpenditure = {
  readonly incomePence: Pence;
  readonly expenditurePence: Pence;
  readonly netPence: Pence;
};

/** Income vs. expenditure across every categorised line in the period - the
 * same lines `computeSpendingByCategory` breaks down, just summed instead of
 * grouped, so the two reports always reconcile with each other. */
export const computeIncomeVsExpenditure = (
  lines: readonly LedgerLine[],
  from: string,
  to: string,
): IncomeVsExpenditure => {
  let income: Pence = ZERO;
  let expenditure: Pence = ZERO;
  for (const line of lines) {
    if (line.categoryId === null || !inPeriod(line.date, from, to)) continue;
    if (isPositive(line.amountPence)) income = add(income, line.amountPence);
    else if (isNegative(line.amountPence)) expenditure = add(expenditure, negate(line.amountPence));
  }
  return {
    incomePence: income,
    expenditurePence: expenditure,
    netPence: subtract(income, expenditure),
  };
};

export type NetWorthPoint = {
  readonly month: MonthKey;
  readonly netWorthPence: Pence;
};

/**
 * Total balance across every account - on-budget or off - as of the end of
 * each month in `months`, which must be ascending. Every line counts here,
 * categorised or not: net worth is a statement about accounts, not budget
 * categories.
 */
export const computeNetWorthByMonth = (
  lines: readonly LedgerLine[],
  months: readonly MonthKey[],
): readonly NetWorthPoint[] => {
  const sorted = lines.toSorted((a, b) => a.date.localeCompare(b.date));
  const balances = new Map<AccountId, Pence>();
  let index = 0;
  const points: NetWorthPoint[] = [];
  for (const month of months) {
    while (index < sorted.length && compareMonths(monthOf(sorted[index]!.date), month) <= 0) {
      const line = sorted[index]!;
      balances.set(line.accountId, add(balances.get(line.accountId) ?? ZERO, line.amountPence));
      index++;
    }
    points.push({ month, netWorthPence: sum(Array.from(balances.values())) });
  }
  return points;
};
