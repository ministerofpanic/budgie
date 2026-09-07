import { unsafePence as p } from "@budgie/core/money";
import { describe, expect, it } from "vitest";
import { computeAgeOfMoney } from "../src/age-of-money";
import type { BudgetInput } from "../src/types";

const baseInput: BudgetInput = {
  firstMonth: "2026-01",
  accounts: [
    { id: "checking", onBudget: true },
    { id: "credit-card", onBudget: true },
    { id: "investments", onBudget: false },
  ],
  categories: [
    { id: "groceries" },
    { id: "card-payment", role: { kind: "payment", accountId: "credit-card" } },
  ],
  assignments: [],
  transactions: [],
};

const withTransactions = (transactions: BudgetInput["transactions"]): BudgetInput => ({
  ...baseInput,
  transactions,
});

describe("computeAgeOfMoney", () => {
  it("is the age of the money consumed by a single outflow", () => {
    const input = withTransactions([
      {
        kind: "category",
        id: "t1",
        accountId: "checking",
        date: "2026-01-01",
        entries: [{ categoryId: "groceries", amountPence: p(10_000) }],
      },
      {
        kind: "category",
        id: "t2",
        accountId: "checking",
        date: "2026-01-11",
        entries: [{ categoryId: "groceries", amountPence: p(-3_000) }],
      },
    ]);
    expect(computeAgeOfMoney(input)).toBe(10);
  });

  it("ages against the oldest inflow when an outflow only partially drains it (FIFO, not average)", () => {
    const input = withTransactions([
      {
        kind: "category",
        id: "inflow-1",
        accountId: "checking",
        date: "2026-01-01",
        entries: [{ categoryId: "groceries", amountPence: p(5_000) }],
      },
      {
        kind: "category",
        id: "inflow-2",
        accountId: "checking",
        date: "2026-01-20",
        entries: [{ categoryId: "groceries", amountPence: p(5_000) }],
      },
      {
        // Only 2,000 of the first (older) 5,000 batch is consumed - age
        // must be against the Jan 1 batch, not an average with Jan 20.
        kind: "category",
        id: "outflow",
        accountId: "checking",
        date: "2026-01-25",
        entries: [{ categoryId: "groceries", amountPence: p(-2_000) }],
      },
    ]);
    expect(computeAgeOfMoney(input)).toBe(24);
  });

  it("ignores a credit-card purchase - only the later card payment is a real cash outflow", () => {
    const input = withTransactions([
      {
        kind: "category",
        id: "inflow",
        accountId: "checking",
        date: "2026-01-01",
        entries: [{ categoryId: "groceries", amountPence: p(10_000) }],
      },
      {
        // Spending on the credit card must not itself register as an
        // outflow - if it did, Age of Money would be measured from here.
        kind: "category",
        id: "card-purchase",
        accountId: "credit-card",
        date: "2026-01-05",
        entries: [{ categoryId: "groceries", amountPence: p(-4_000) }],
      },
      {
        // Paying the card off is the actual moment cash leaves.
        kind: "transfer",
        id: "card-payment",
        date: "2026-01-30",
        fromAccountId: "checking",
        toAccountId: "credit-card",
        amountPence: p(4_000),
      },
    ]);
    expect(computeAgeOfMoney(input)).toBe(29);
  });

  it("nets a transfer between two on-budget cash accounts to zero", () => {
    const input: BudgetInput = {
      ...baseInput,
      accounts: [...baseInput.accounts, { id: "savings", onBudget: true }],
      transactions: [
        {
          kind: "category",
          id: "inflow",
          accountId: "checking",
          date: "2026-01-01",
          entries: [{ categoryId: "groceries", amountPence: p(10_000) }],
        },
        {
          // Moving cash between two on-budget accounts must not create a
          // new, more-recent "inflow" that would reset the age.
          kind: "transfer",
          id: "internal-move",
          date: "2026-01-15",
          fromAccountId: "checking",
          toAccountId: "savings",
          amountPence: p(5_000),
        },
        {
          kind: "category",
          id: "outflow",
          accountId: "savings",
          date: "2026-01-20",
          entries: [{ categoryId: "groceries", amountPence: p(-1_000) }],
        },
      ],
    };
    expect(computeAgeOfMoney(input)).toBe(19);
  });

  it("returns null when there's no outflow yet", () => {
    const input = withTransactions([
      {
        kind: "category",
        id: "inflow",
        accountId: "checking",
        date: "2026-01-01",
        entries: [{ categoryId: "groceries", amountPence: p(10_000) }],
      },
    ]);
    expect(computeAgeOfMoney(input)).toBeNull();
  });

  it("returns null with no transactions at all", () => {
    expect(computeAgeOfMoney(baseInput)).toBeNull();
  });
});
