import { describe, expect, it } from "vitest";
import { applyOpOptimistically } from "@/lib/offline/apply-op";
import type { OutboxOp } from "@/lib/offline/db";
import type { OfflineSnapshot } from "@/lib/dal/offline";

const baseSnapshot: OfflineSnapshot = {
  budgetId: "budget-1",
  fetchedAt: "2026-01-01T00:00:00.000Z",
  firstMonth: "2026-01-01",
  homeCurrency: "GBP",
  accounts: [
    {
      id: "acc-1",
      name: "Checking",
      currency: "GBP",
      type: "current",
      onBudget: true,
      closed: false,
    },
  ],
  categoryGroups: [{ id: "grp-1", name: "Everyday", sortOrder: 0, hidden: false, isSystem: false }],
  categories: [
    {
      id: "cat-1",
      groupId: "grp-1",
      name: "Groceries",
      sortOrder: 0,
      hidden: false,
      paymentForAccountId: null,
      isInflow: false,
    },
  ],
  assignments: [],
  transactions: [
    {
      id: "t1",
      accountId: "acc-1",
      date: "2026-01-05",
      payeeId: null,
      categoryId: "cat-1",
      amountPence: -1000,
      exchangeRate: null,
      memo: null,
      cleared: true,
      reconciled: false,
      runningBalancePence: -1000,
      updatedAt: "2026-01-05T00:00:00.000Z",
    },
  ],
  transactionSplits: [],
  payees: [],
};

describe("applyOpOptimistically - createTransaction", () => {
  it("adds a new transaction and recomputes the running balance for its account", () => {
    const op: OutboxOp = {
      id: "op-1",
      sequence: 1,
      kind: "createTransaction",
      budgetId: "budget-1",
      clientTimestamp: "2026-01-10T00:00:00.000Z",
      input: { accountId: "acc-1", date: "2026-01-10", outflowInput: "5.00", categoryId: "cat-1" },
    };

    const next = applyOpOptimistically(baseSnapshot, op);

    expect(next.transactions).toHaveLength(2);
    const added = next.transactions.find((t) => t.id === `local-${op.id}`);
    expect(added?.amountPence).toBe(-500);
    expect(added?.runningBalancePence).toBe(-1500);
  });

  it("leaves the snapshot untouched when the amount can't be parsed", () => {
    const op: OutboxOp = {
      id: "op-2",
      sequence: 1,
      kind: "createTransaction",
      budgetId: "budget-1",
      clientTimestamp: "2026-01-10T00:00:00.000Z",
      input: { accountId: "acc-1", date: "2026-01-10" },
    };

    expect(applyOpOptimistically(baseSnapshot, op)).toBe(baseSnapshot);
  });
});

describe("applyOpOptimistically - updateTransaction", () => {
  it("patches the row and recomputes running balances", () => {
    const op: OutboxOp = {
      id: "op-3",
      sequence: 1,
      kind: "updateTransaction",
      budgetId: "budget-1",
      clientTimestamp: "2026-01-11T00:00:00.000Z",
      transactionId: "t1",
      input: { accountId: "acc-1", date: "2026-01-05", outflowInput: "20.00", categoryId: "cat-1" },
      expectedUpdatedAt: "2026-01-05T00:00:00.000Z",
    };

    const next = applyOpOptimistically(baseSnapshot, op);
    const updated = next.transactions.find((t) => t.id === "t1");
    expect(updated?.amountPence).toBe(-2000);
    expect(updated?.runningBalancePence).toBe(-2000);
  });
});

describe("applyOpOptimistically - deleteTransaction", () => {
  it("removes the row and recomputes the account's running balances", () => {
    const op: OutboxOp = {
      id: "op-4",
      sequence: 1,
      kind: "deleteTransaction",
      budgetId: "budget-1",
      clientTimestamp: "2026-01-11T00:00:00.000Z",
      transactionId: "t1",
      expectedUpdatedAt: "2026-01-05T00:00:00.000Z",
    };

    const next = applyOpOptimistically(baseSnapshot, op);
    expect(next.transactions).toHaveLength(0);
  });
});

describe("applyOpOptimistically - assignCategory", () => {
  it("inserts a new assignment when none exists yet", () => {
    const op: OutboxOp = {
      id: "op-5",
      sequence: 1,
      kind: "assignCategory",
      budgetId: "budget-1",
      clientTimestamp: "2026-01-11T00:00:00.000Z",
      categoryId: "cat-1",
      month: "2026-01",
      amountInput: "50.00",
      expectedUpdatedAt: undefined,
    };

    const next = applyOpOptimistically(baseSnapshot, op);
    expect(next.assignments).toEqual([
      { categoryId: "cat-1", month: "2026-01", assignedPence: 5000, updatedAt: op.clientTimestamp },
    ]);
  });

  it("replaces an existing assignment for the same category and month", () => {
    const withAssignment: OfflineSnapshot = {
      ...baseSnapshot,
      assignments: [
        {
          categoryId: "cat-1",
          month: "2026-01",
          assignedPence: 1000,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    const op: OutboxOp = {
      id: "op-6",
      sequence: 1,
      kind: "assignCategory",
      budgetId: "budget-1",
      clientTimestamp: "2026-01-11T00:00:00.000Z",
      categoryId: "cat-1",
      month: "2026-01",
      amountInput: "75.00",
      expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
    };

    const next = applyOpOptimistically(withAssignment, op);
    expect(next.assignments).toHaveLength(1);
    expect(next.assignments[0]?.assignedPence).toBe(7500);
  });
});
