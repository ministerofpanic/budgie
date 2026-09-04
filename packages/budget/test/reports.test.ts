import { describe, expect, it } from "vitest";
import { unsafePence } from "@budgie/core/money";
import {
  computeIncomeVsExpenditure,
  computeNetWorthByMonth,
  computeSpendingByCategory,
  type LedgerLine,
} from "../src/reports";

const line = (
  accountId: string,
  categoryId: string | null,
  date: string,
  amountPence: number,
): LedgerLine => ({ accountId, categoryId, date, amountPence: unsafePence(amountPence) });

describe("computeSpendingByCategory", () => {
  const lines: readonly LedgerLine[] = [
    line("acc-1", "groceries", "2026-08-03", -2000),
    line("acc-1", "groceries", "2026-08-20", -1500),
    line("acc-1", "groceries", "2026-08-25", 500), // refund
    line("acc-1", "rent", "2026-08-01", -80000),
    line("acc-1", "groceries", "2026-09-01", -1000), // outside the period
    line("acc-1", null, "2026-08-10", -5000), // transfer / uncategorised - excluded
  ];

  it("sums spend and income per category within the period", () => {
    const totals = computeSpendingByCategory(lines, "2026-08-01", "2026-08-31");
    const groceries = totals.find((row) => row.categoryId === "groceries");
    const rent = totals.find((row) => row.categoryId === "rent");
    expect(groceries).toEqual({ categoryId: "groceries", spentPence: 3500, incomePence: 500 });
    expect(rent).toEqual({ categoryId: "rent", spentPence: 80000, incomePence: 0 });
  });

  it("excludes lines with no category and lines outside the period", () => {
    const totals = computeSpendingByCategory(lines, "2026-08-01", "2026-08-31");
    expect(totals).toHaveLength(2);
  });

  it("reconciles: total spend across categories equals total negative activity in the period", () => {
    const totals = computeSpendingByCategory(lines, "2026-08-01", "2026-08-31");
    const totalSpend = totals.reduce((sum, row) => sum + row.spentPence, 0);
    const expected = lines
      .filter((l) => l.categoryId !== null && l.date >= "2026-08-01" && l.date <= "2026-08-31")
      .filter((l) => l.amountPence < 0)
      .reduce((sum, l) => sum - l.amountPence, 0);
    expect(totalSpend).toBe(expected);
  });
});

describe("computeIncomeVsExpenditure", () => {
  const lines: readonly LedgerLine[] = [
    line("acc-1", "salary", "2026-08-01", 250000),
    line("acc-1", "groceries", "2026-08-05", -3500),
    line("acc-1", "rent", "2026-08-01", -80000),
    line("acc-1", null, "2026-08-10", -5000),
  ];

  it("sums income and expenditure across categorised lines", () => {
    const result = computeIncomeVsExpenditure(lines, "2026-08-01", "2026-08-31");
    expect(result).toEqual({ incomePence: 250000, expenditurePence: 83500, netPence: 166500 });
  });

  it("matches the sum of a per-category breakdown for the same period", () => {
    const totals = computeSpendingByCategory(lines, "2026-08-01", "2026-08-31");
    const result = computeIncomeVsExpenditure(lines, "2026-08-01", "2026-08-31");
    const spentFromBreakdown = totals.reduce((sum, row) => sum + row.spentPence, 0);
    const incomeFromBreakdown = totals.reduce((sum, row) => sum + row.incomePence, 0);
    expect(spentFromBreakdown).toBe(result.expenditurePence);
    expect(incomeFromBreakdown).toBe(result.incomePence);
  });
});

describe("computeNetWorthByMonth", () => {
  it("accumulates every line per account, categorised or not", () => {
    const lines: readonly LedgerLine[] = [
      line("checking", "salary", "2026-07-01", 200000),
      line("checking", "rent", "2026-07-01", -80000),
      line("checking", null, "2026-07-15", -10000), // e.g. a transfer out
      line("savings", null, "2026-07-15", 10000), // the matching transfer in
      line("checking", "groceries", "2026-08-05", -3000),
    ];
    const points = computeNetWorthByMonth(lines, ["2026-06", "2026-07", "2026-08"]);
    expect(points).toEqual([
      { month: "2026-06", netWorthPence: 0 },
      { month: "2026-07", netWorthPence: 120000 },
      { month: "2026-08", netWorthPence: 117000 },
    ]);
  });

  it("is unaffected by which account a balanced transfer sits on", () => {
    const lines: readonly LedgerLine[] = [
      line("checking", "salary", "2026-07-01", 100000),
      line("checking", null, "2026-07-10", -25000),
      line("savings", null, "2026-07-10", 25000),
    ];
    const points = computeNetWorthByMonth(lines, ["2026-07"]);
    expect(points[0]?.netWorthPence).toBe(100000);
  });
});
