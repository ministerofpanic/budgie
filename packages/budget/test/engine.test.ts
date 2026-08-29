import { unsafePence as p } from "@budgie/core/money";
import { describe, expect, it } from "vitest";
import { computeMonth } from "../src/engine";
import type { BudgetInput, CategoryMonthResult } from "../src/types";

const availableOf = (categories: readonly CategoryMonthResult[], categoryId: string) =>
  categories.find((category) => category.categoryId === categoryId)?.available;

const activityOf = (categories: readonly CategoryMonthResult[], categoryId: string) =>
  categories.find((category) => category.categoryId === categoryId)?.activity;

describe("computeMonth - basics", () => {
  it("available is carried-in + assigned + activity", () => {
    const input: BudgetInput = {
      firstMonth: "2026-01",
      accounts: [{ id: "checking", onBudget: true }],
      categories: [{ id: "groceries" }],
      assignments: [{ categoryId: "groceries", month: "2026-01", assignedPence: p(10_000) }],
      transactions: [
        {
          kind: "category",
          id: "t1",
          accountId: "checking",
          date: "2026-01-05",
          entries: [{ categoryId: "groceries", amountPence: p(-4_000) }],
        },
      ],
    };

    const result = computeMonth(input, "2026-01");
    expect(activityOf(result.categories, "groceries")).toBe(p(-4_000));
    expect(availableOf(result.categories, "groceries")).toBe(p(6_000));
  });

  it("rejects a month before the budget started", () => {
    const input: BudgetInput = {
      firstMonth: "2026-03",
      accounts: [],
      categories: [],
      assignments: [],
      transactions: [],
    };
    expect(() => computeMonth(input, "2026-01")).toThrow(RangeError);
  });

  it("a transfer between two on-budget accounts has no category effect", () => {
    const input: BudgetInput = {
      firstMonth: "2026-01",
      accounts: [
        { id: "checking", onBudget: true },
        { id: "savings", onBudget: true },
      ],
      categories: [{ id: "groceries" }],
      assignments: [],
      transactions: [
        {
          kind: "transfer",
          id: "t1",
          date: "2026-01-05",
          fromAccountId: "checking",
          toAccountId: "savings",
          amountPence: p(50_000),
        },
      ],
    };

    const result = computeMonth(input, "2026-01");
    expect(result.readyToAssign).toBe(p(0));
    expect(availableOf(result.categories, "groceries")).toBe(p(0));
  });
});

describe("computeMonth - Ready to Assign", () => {
  it("is inflow minus assigned", () => {
    const input: BudgetInput = {
      firstMonth: "2026-01",
      accounts: [{ id: "checking", onBudget: true }],
      categories: [{ id: "inflow", role: { kind: "inflow" } }, { id: "groceries" }],
      assignments: [{ categoryId: "groceries", month: "2026-01", assignedPence: p(10_000) }],
      transactions: [
        {
          kind: "category",
          id: "t1",
          accountId: "checking",
          date: "2026-01-01",
          entries: [{ categoryId: "inflow", amountPence: p(200_000) }],
        },
      ],
    };

    const result = computeMonth(input, "2026-01");
    expect(result.readyToAssign).toBe(p(190_000));
  });

  it("ignores inflow to an off-budget (tracking) account", () => {
    const input: BudgetInput = {
      firstMonth: "2026-01",
      accounts: [{ id: "investments", onBudget: false }],
      categories: [{ id: "inflow", role: { kind: "inflow" } }],
      assignments: [],
      transactions: [
        {
          kind: "category",
          id: "t1",
          accountId: "investments",
          date: "2026-01-01",
          entries: [{ categoryId: "inflow", amountPence: p(500_000) }],
        },
      ],
    };

    expect(computeMonth(input, "2026-01").readyToAssign).toBe(p(0));
  });
});

const twoMonthInput = (month1Assigned: number, month1Spend: number): BudgetInput => ({
  firstMonth: "2026-01",
  accounts: [{ id: "checking", onBudget: true }],
  categories: [{ id: "groceries" }],
  assignments: [{ categoryId: "groceries", month: "2026-01", assignedPence: p(month1Assigned) }],
  transactions: [
    {
      kind: "category",
      id: "t1",
      accountId: "checking",
      date: "2026-01-05",
      entries: [{ categoryId: "groceries", amountPence: p(month1Spend) }],
    },
  ],
});

describe("computeMonth - rollover", () => {
  it("a positive balance carries into the next month", () => {
    const input = twoMonthInput(10_000, -4_000);
    const month2 = computeMonth(input, "2026-02");
    // carried-in 6,000 + nothing assigned or spent in month 2.
    expect(availableOf(month2.categories, "groceries")).toBe(p(6_000));
  });

  it("cash overspending resets to zero and reduces the next month's Ready to Assign", () => {
    const input = twoMonthInput(1_000, -3_000);
    const month1 = computeMonth(input, "2026-01");
    expect(availableOf(month1.categories, "groceries")).toBe(p(-2_000));

    const month2 = computeMonth(input, "2026-02");
    expect(availableOf(month2.categories, "groceries")).toBe(p(0));
    // Ready to Assign is a running total: month 1 already went to -1,000
    // from assigning money with no inflow to back it, and month 2 docks a
    // further 2,000 for the cash overspend on top of that.
    expect(month2.readyToAssign).toBe(p(-3_000));
  });
});

const creditInput = (assigned: number, spend: number): BudgetInput => ({
  firstMonth: "2026-01",
  accounts: [
    { id: "checking", onBudget: true },
    { id: "credit-card", onBudget: true },
  ],
  categories: [
    { id: "dining" },
    { id: "card-payment", role: { kind: "payment", accountId: "credit-card" } },
  ],
  assignments: [{ categoryId: "dining", month: "2026-01", assignedPence: p(assigned) }],
  transactions: [
    {
      kind: "category",
      id: "t1",
      accountId: "credit-card",
      date: "2026-01-10",
      entries: [{ categoryId: "dining", amountPence: p(spend) }],
    },
  ],
});

describe("computeMonth - credit cards", () => {
  it("fully-covered spending moves the whole amount into the payment category", () => {
    const result = computeMonth(creditInput(5_000, -3_000), "2026-01");
    expect(availableOf(result.categories, "dining")).toBe(p(2_000));
    expect(activityOf(result.categories, "card-payment")).toBe(p(3_000));
    expect(availableOf(result.categories, "card-payment")).toBe(p(3_000));
  });

  it("overspending only moves what was available, and the rest overspends the category", () => {
    // 1,000 available, 3,000 spent: 1,000 moves to the payment category,
    // dining overspends by 2,000 rather than the payment category taking on
    // the excess.
    const result = computeMonth(creditInput(1_000, -3_000), "2026-01");
    expect(availableOf(result.categories, "dining")).toBe(p(-2_000));
    expect(availableOf(result.categories, "card-payment")).toBe(p(1_000));
  });

  it("overspending on a card is cash-style overspend for the spending category", () => {
    const input = creditInput(1_000, -3_000);
    const month2 = computeMonth(input, "2026-02");
    expect(availableOf(month2.categories, "dining")).toBe(p(0));
    // Same running-total reasoning as the cash-overspend case above.
    expect(month2.readyToAssign).toBe(p(-3_000));
  });

  it("spending on a credit account with no linked payment category is ordinary activity", () => {
    const input: BudgetInput = {
      firstMonth: "2026-01",
      accounts: [{ id: "credit-card", onBudget: true }],
      categories: [{ id: "dining" }],
      assignments: [{ categoryId: "dining", month: "2026-01", assignedPence: p(5_000) }],
      transactions: [
        {
          kind: "category",
          id: "t1",
          accountId: "credit-card",
          date: "2026-01-10",
          entries: [{ categoryId: "dining", amountPence: p(-3_000) }],
        },
      ],
    };
    const result = computeMonth(input, "2026-01");
    expect(availableOf(result.categories, "dining")).toBe(p(2_000));
  });

  it("paying the card reduces the payment category, even below zero", () => {
    const input: BudgetInput = {
      firstMonth: "2026-01",
      accounts: [
        { id: "checking", onBudget: true },
        { id: "credit-card", onBudget: true },
      ],
      categories: [{ id: "card-payment", role: { kind: "payment", accountId: "credit-card" } }],
      assignments: [{ categoryId: "card-payment", month: "2026-01", assignedPence: p(3_000) }],
      transactions: [
        {
          kind: "transfer",
          id: "t1",
          date: "2026-01-20",
          fromAccountId: "checking",
          toAccountId: "credit-card",
          amountPence: p(5_000),
        },
      ],
    };

    const result = computeMonth(input, "2026-01");
    // 3,000 set aside, 5,000 paid: the extra 2,000 wasn't budgeted for.
    expect(availableOf(result.categories, "card-payment")).toBe(p(-2_000));
  });

  it("a payment category's negative balance carries forward instead of resetting", () => {
    const input: BudgetInput = {
      firstMonth: "2026-01",
      accounts: [
        { id: "checking", onBudget: true },
        { id: "credit-card", onBudget: true },
      ],
      categories: [{ id: "card-payment", role: { kind: "payment", accountId: "credit-card" } }],
      assignments: [{ categoryId: "card-payment", month: "2026-01", assignedPence: p(3_000) }],
      transactions: [
        {
          kind: "transfer",
          id: "t1",
          date: "2026-01-20",
          fromAccountId: "checking",
          toAccountId: "credit-card",
          amountPence: p(5_000),
        },
      ],
    };

    const month2 = computeMonth(input, "2026-02");
    // Unlike a normal category's cash overspend, this doesn't reset to zero,
    // and - the actual point of this test - Ready to Assign for month 2
    // isn't docked any *further* for it: it only reflects month 1's own
    // assign-with-no-inflow shortfall, carried forward unchanged.
    expect(availableOf(month2.categories, "card-payment")).toBe(p(-2_000));
    const month1 = computeMonth(input, "2026-01");
    expect(month2.readyToAssign).toBe(month1.readyToAssign);
  });
});

describe("computeMonth - multi-month scenario", () => {
  it("combines overspend, rollover, credit card spending and a payment across three months", () => {
    const input: BudgetInput = {
      firstMonth: "2026-01",
      accounts: [
        { id: "checking", onBudget: true },
        { id: "credit-card", onBudget: true },
      ],
      categories: [
        { id: "inflow", role: { kind: "inflow" } },
        { id: "groceries" },
        { id: "dining" },
        { id: "card-payment", role: { kind: "payment", accountId: "credit-card" } },
      ],
      assignments: [
        { categoryId: "groceries", month: "2026-01", assignedPence: p(20_000) },
        { categoryId: "dining", month: "2026-01", assignedPence: p(5_000) },
        { categoryId: "groceries", month: "2026-02", assignedPence: p(15_000) },
        { categoryId: "card-payment", month: "2026-02", assignedPence: p(4_000) },
        { categoryId: "groceries", month: "2026-03", assignedPence: p(10_000) },
      ],
      transactions: [
        {
          kind: "category",
          id: "income-jan",
          accountId: "checking",
          date: "2026-01-01",
          entries: [{ categoryId: "inflow", amountPence: p(300_000) }],
        },
        {
          // Groceries: 20,000 assigned, 12,000 spent - 8,000 rolls forward.
          kind: "category",
          id: "groceries-jan",
          accountId: "checking",
          date: "2026-01-10",
          entries: [{ categoryId: "groceries", amountPence: p(-12_000) }],
        },
        {
          // Dining on the credit card: only 5,000 available, 8,000 spent -
          // 5,000 moves to the payment category, dining overspends by 3,000.
          kind: "category",
          id: "dining-jan",
          accountId: "credit-card",
          date: "2026-01-15",
          entries: [{ categoryId: "dining", amountPence: p(-8_000) }],
        },
        {
          // Paying down the card in February: only 5,000 was ever set aside,
          // so this pushes the payment category negative by 1,000.
          kind: "transfer",
          id: "payment-feb",
          date: "2026-02-05",
          fromAccountId: "checking",
          toAccountId: "credit-card",
          amountPence: p(6_000),
        },
      ],
    };

    const month1 = computeMonth(input, "2026-01");
    expect(availableOf(month1.categories, "groceries")).toBe(p(8_000));
    expect(availableOf(month1.categories, "dining")).toBe(p(-3_000));
    expect(availableOf(month1.categories, "card-payment")).toBe(p(5_000));
    // 300,000 inflow - 25,000 assigned (20,000 + 5,000), no prior overspend.
    expect(month1.readyToAssign).toBe(p(275_000));

    const month2 = computeMonth(input, "2026-02");
    // Groceries: 8,000 carried in + 15,000 assigned, nothing spent.
    expect(availableOf(month2.categories, "groceries")).toBe(p(23_000));
    // Dining reset to zero - its January overspend doesn't carry as debt.
    expect(availableOf(month2.categories, "dining")).toBe(p(0));
    // Payment category: 5,000 carried in + 4,000 assigned - 6,000 paid.
    expect(availableOf(month2.categories, "card-payment")).toBe(p(3_000));
    // No inflow, 19,000 assigned (15,000 + 4,000), minus dining's 3,000
    // cash-style overspend from January.
    expect(month2.readyToAssign).toBe(p(275_000 - 19_000 - 3_000));

    const month3 = computeMonth(input, "2026-03");
    expect(availableOf(month3.categories, "groceries")).toBe(p(33_000));
    expect(availableOf(month3.categories, "card-payment")).toBe(p(3_000));
    expect(month3.readyToAssign).toBe(p(275_000 - 19_000 - 3_000 - 10_000));
  });
});
