import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
  deleteTransactionWithConflictCheckAction: vi.fn(),
  assignCategoryAction: vi.fn(),
  getOfflineSnapshotAction: vi.fn(),
}));
vi.mock("@/lib/actions/budget-actions", () => actions);

const { buildOp, listConflicts, listOutbox, queueOp, syncNow } = await import("@/lib/offline/sync");
const { getOfflineDb } = await import("@/lib/offline/db");

const emptySnapshot = {
  budgetId: "budget-1",
  fetchedAt: "2026-01-01T00:00:00.000Z",
  firstMonth: "2026-01-01",
  homeCurrency: "GBP",
  accounts: [],
  categoryGroups: [],
  categories: [],
  assignments: [],
  transactions: [],
  transactionSplits: [],
  payees: [],
};

beforeEach(async () => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis.navigator, "onLine", { value: true, configurable: true });
  const db = await getOfflineDb();
  await db.clear("snapshot");
  await db.clear("outbox");
  await db.clear("conflicts");
});

describe("syncNow", () => {
  it("does nothing while offline", async () => {
    Object.defineProperty(globalThis.navigator, "onLine", { value: false, configurable: true });
    await queueOp(buildOp("budget-1", { kind: "createTransaction", input: {} }));

    await syncNow("budget-1");

    expect(actions.createTransactionAction).not.toHaveBeenCalled();
    expect(await listOutbox("budget-1")).toHaveLength(1);
  });

  it("drains the outbox in queued order, then pulls a fresh snapshot", async () => {
    actions.createTransactionAction.mockResolvedValue({ ok: true, value: { id: "t1" } });
    actions.assignCategoryAction.mockResolvedValue({ ok: true, value: 5000 });
    actions.getOfflineSnapshotAction.mockResolvedValue(emptySnapshot);

    const order: string[] = [];
    actions.createTransactionAction.mockImplementation(() => {
      order.push("create");
      return Promise.resolve({ ok: true, value: { id: "t1" } });
    });
    actions.assignCategoryAction.mockImplementation(() => {
      order.push("assign");
      return Promise.resolve({ ok: true, value: 5000 });
    });

    await queueOp(buildOp("budget-1", { kind: "createTransaction", input: {} }));
    await queueOp(
      buildOp("budget-1", {
        kind: "assignCategory",
        categoryId: "cat-1",
        month: "2026-01",
        amountInput: "50.00",
        expectedUpdatedAt: undefined,
      }),
    );

    await syncNow("budget-1");

    expect(order).toEqual(["create", "assign"]);
    expect(await listOutbox("budget-1")).toHaveLength(0);
    expect(actions.getOfflineSnapshotAction).toHaveBeenCalledTimes(1);
  });

  it("moves a rejected op to conflicts instead of retrying silently", async () => {
    actions.updateTransactionAction.mockResolvedValue({ ok: false, error: { kind: "conflict" } });
    actions.getOfflineSnapshotAction.mockResolvedValue(emptySnapshot);

    const op = buildOp("budget-1", {
      kind: "updateTransaction",
      transactionId: "t1",
      input: {},
      expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    await queueOp(op);

    await syncNow("budget-1");

    expect(await listOutbox("budget-1")).toHaveLength(0);
    const conflicts = await listConflicts("budget-1");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.reason).toBe("conflict");
  });
});
