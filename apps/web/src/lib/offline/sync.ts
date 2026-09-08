import { getOfflineDb, type ConflictEntry, type OutboxOp } from "@/lib/offline/db";
import type { OfflineSnapshot } from "@/lib/dal/offline";
import {
  assignCategoryAction,
  createTransactionAction,
  deleteTransactionWithConflictCheckAction,
  getOfflineSnapshotAction,
  updateTransactionAction,
} from "@/lib/actions/budget-actions";

const randomId = (): string =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36);

let sequenceCounter = 0;
const nextSequence = (): number => sequenceCounter++;

export const saveSnapshot = async (snapshot: OfflineSnapshot): Promise<void> => {
  const db = await getOfflineDb();
  await db.put("snapshot", snapshot, snapshot.budgetId);
};

export const loadSnapshot = async (budgetId: string): Promise<OfflineSnapshot | undefined> => {
  const db = await getOfflineDb();
  return db.get("snapshot", budgetId);
};

export const queueOp = async (op: OutboxOp): Promise<void> => {
  const db = await getOfflineDb();
  await db.put("outbox", op);
};

export const listOutbox = async (budgetId: string): Promise<readonly OutboxOp[]> => {
  const db = await getOfflineDb();
  return db.getAllFromIndex("outbox", "budgetId", budgetId);
};

const removeFromOutbox = async (id: string): Promise<void> => {
  const db = await getOfflineDb();
  await db.delete("outbox", id);
};

const moveToConflicts = async (op: OutboxOp, reason: string): Promise<void> => {
  const db = await getOfflineDb();
  const entry: ConflictEntry = { id: op.id, op, reason, queuedAt: new Date().toISOString() };
  await db.put("conflicts", entry);
  await db.delete("outbox", op.id);
};

export const listConflicts = async (budgetId: string): Promise<readonly ConflictEntry[]> => {
  const db = await getOfflineDb();
  return db.getAllFromIndex("conflicts", "budgetId", budgetId);
};

export const discardConflict = async (id: string): Promise<void> => {
  const db = await getOfflineDb();
  await db.delete("conflicts", id);
};

/** Re-queues a conflicted op, forcing the write regardless of what the
 * server currently holds - the user has explicitly chosen "keep mine". */
export const retryConflictForcingLocal = async (id: string): Promise<void> => {
  const db = await getOfflineDb();
  const entry = await db.get("conflicts", id);
  if (!entry) return;
  const op = entry.op;
  const forced: OutboxOp =
    op.kind === "updateTransaction"
      ? { ...op, expectedUpdatedAt: "" }
      : op.kind === "deleteTransaction"
        ? { ...op, expectedUpdatedAt: "" }
        : op.kind === "assignCategory"
          ? { ...op, expectedUpdatedAt: undefined }
          : op;
  await db.delete("conflicts", id);
  await db.put("outbox", forced);
};

/** Builds the queue entry for one mutation, given the pure client-side
 * intent - the caller (offline views) decides what changed; this just
 * shapes it for the outbox. */
export const buildOp = (
  budgetId: string,
  intent:
    | { readonly kind: "createTransaction"; readonly input: Record<string, unknown> }
    | {
        readonly kind: "updateTransaction";
        readonly transactionId: string;
        readonly input: Record<string, unknown>;
        readonly expectedUpdatedAt: string;
      }
    | {
        readonly kind: "deleteTransaction";
        readonly transactionId: string;
        readonly expectedUpdatedAt: string;
      }
    | {
        readonly kind: "assignCategory";
        readonly categoryId: string;
        readonly month: string;
        readonly amountInput: string;
        readonly expectedUpdatedAt: string | undefined;
      },
): OutboxOp => ({
  id: randomId(),
  sequence: nextSequence(),
  budgetId,
  clientTimestamp: new Date().toISOString(),
  ...intent,
});

/** Replays one queued op against the real Server Action. Returns true if it
 * succeeded (or was force-applied) and should be removed from the outbox,
 * false if it was moved to `conflicts` instead. */
const replayOne = async (op: OutboxOp): Promise<boolean> => {
  if (op.kind === "createTransaction") {
    const result = await createTransactionAction(op.input);
    if (!result.ok) {
      await moveToConflicts(op, result.error.kind);
      return false;
    }
    return true;
  }

  if (op.kind === "updateTransaction") {
    const result = await updateTransactionAction(op.transactionId, {
      ...op.input,
      expectedUpdatedAt: op.expectedUpdatedAt || undefined,
    });
    if (!result.ok) {
      await moveToConflicts(op, result.error.kind);
      return false;
    }
    return true;
  }

  if (op.kind === "deleteTransaction") {
    if (!op.expectedUpdatedAt) {
      // Forced retry after a conflict - fall back to a best-effort delete
      // with no guard, since the user explicitly chose "keep mine".
      await deleteTransactionWithConflictCheckAction(op.transactionId, "");
      return true;
    }
    const result = await deleteTransactionWithConflictCheckAction(
      op.transactionId,
      op.expectedUpdatedAt,
    );
    if (!result.ok) {
      await moveToConflicts(op, result.error.kind);
      return false;
    }
    return true;
  }

  const result = await assignCategoryAction(
    op.categoryId,
    op.month,
    op.amountInput,
    op.expectedUpdatedAt,
  );
  if (!result.ok) {
    await moveToConflicts(op, result.error.kind);
    return false;
  }
  return true;
};

/** Drains the outbox in queued order, then pulls a fresh snapshot - always
 * in that order, so an unsynced local edit is never clobbered by a stale
 * pull. Safe to call opportunistically (on reconnect, on foreground, on a
 * timer) since it's a no-op when the outbox is already empty. */
export const syncNow = async (budgetId: string): Promise<void> => {
  if (!navigator.onLine) return;

  const pending = await listOutbox(budgetId);
  for (const op of pending.toSorted((a, b) => a.sequence - b.sequence)) {
    const ok = await replayOne(op);
    if (ok) await removeFromOutbox(op.id);
  }

  const snapshot = await getOfflineSnapshotAction();
  await saveSnapshot(snapshot);
};
