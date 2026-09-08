import { add, parseAmount, ZERO, type Pence } from "@budgie/core/money";
import type { OfflineSnapshot } from "@/lib/dal/offline";
import type { OutboxOp } from "@/lib/offline/db";

type Transaction = OfflineSnapshot["transactions"][number];

/** Mirrors `recalculateRunningBalances`'s SQL window function
 * (transactions.ts) in plain JS: a running sum in (date, id) order, scoped
 * to one account. Pure and small enough to keep in lockstep by hand. */
const recomputeRunningBalances = (
  transactions: readonly Transaction[],
  accountId: string,
): readonly Transaction[] => {
  const forAccount = transactions
    .filter((t) => t.accountId === accountId)
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let running: Pence = ZERO;
  const balanceById = new Map<string, number>();
  for (const t of forAccount) {
    running = add(running, t.amountPence as Pence);
    balanceById.set(t.id, running);
  }

  return transactions.map((t) =>
    t.accountId === accountId
      ? { ...t, runningBalancePence: balanceById.get(t.id) ?? t.runningBalancePence }
      : t,
  );
};

const resolveAmountPence = (input: Record<string, unknown>): number | null => {
  const outflow = typeof input["outflowInput"] === "string" ? input["outflowInput"].trim() : "";
  const inflow = typeof input["inflowInput"] === "string" ? input["inflowInput"].trim() : "";
  const parsed = parseAmount(outflow ? `-${outflow}` : inflow);
  return parsed.ok ? parsed.value : null;
};

/**
 * Applies one queued mutation to the locally-cached snapshot so the offline
 * UI updates instantly, without waiting for a round trip. This is a local
 * projection only - the server is still the source of truth, and `syncNow`
 * overwrites this projection with the real snapshot once the op replays
 * successfully (or moves it to `conflicts` if it doesn't).
 */
export const applyOpOptimistically = (snapshot: OfflineSnapshot, op: OutboxOp): OfflineSnapshot => {
  if (op.kind === "createTransaction") {
    const amountPence = resolveAmountPence(op.input);
    if (amountPence === null) return snapshot;
    const accountId = String(op.input["accountId"] ?? "");
    const newTransaction: Transaction = {
      id: `local-${op.id}`,
      accountId,
      date: String(op.input["date"] ?? ""),
      payeeId: null,
      categoryId: typeof op.input["categoryId"] === "string" ? op.input["categoryId"] : null,
      amountPence,
      exchangeRate: null,
      memo: typeof op.input["memo"] === "string" ? op.input["memo"] : null,
      cleared: Boolean(op.input["cleared"]),
      reconciled: false,
      runningBalancePence: 0,
      updatedAt: op.clientTimestamp,
    };
    const transactions = recomputeRunningBalances(
      [...snapshot.transactions, newTransaction],
      accountId,
    );
    return { ...snapshot, transactions };
  }

  if (op.kind === "updateTransaction") {
    const amountPence = resolveAmountPence(op.input);
    const accountId = String(op.input["accountId"] ?? "");
    const transactions = snapshot.transactions.map((t) =>
      t.id === op.transactionId
        ? {
            ...t,
            accountId,
            date: String(op.input["date"] ?? t.date),
            categoryId: typeof op.input["categoryId"] === "string" ? op.input["categoryId"] : null,
            amountPence: amountPence ?? t.amountPence,
            memo: typeof op.input["memo"] === "string" ? op.input["memo"] : t.memo,
            cleared: Boolean(op.input["cleared"]),
            updatedAt: op.clientTimestamp,
          }
        : t,
    );
    return { ...snapshot, transactions: recomputeRunningBalances(transactions, accountId) };
  }

  if (op.kind === "deleteTransaction") {
    const removed = snapshot.transactions.find((t) => t.id === op.transactionId);
    const transactions = snapshot.transactions.filter((t) => t.id !== op.transactionId);
    return removed
      ? { ...snapshot, transactions: recomputeRunningBalances(transactions, removed.accountId) }
      : { ...snapshot, transactions };
  }

  // assignCategory
  const existingIndex = snapshot.assignments.findIndex(
    (a) => a.categoryId === op.categoryId && a.month === op.month,
  );
  const parsed = parseAmount(op.amountInput);
  if (!parsed.ok) return snapshot;
  const updatedAssignment = {
    categoryId: op.categoryId,
    month: op.month,
    assignedPence: parsed.value,
    updatedAt: op.clientTimestamp,
  };
  const assignments =
    existingIndex === -1
      ? [...snapshot.assignments, updatedAssignment]
      : snapshot.assignments.map((a, i) => (i === existingIndex ? updatedAssignment : a));
  return { ...snapshot, assignments };
};
