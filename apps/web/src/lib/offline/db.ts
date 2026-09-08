import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { OfflineSnapshot } from "@/lib/dal/offline";

type OutboxOpBase = {
  readonly id: string;
  /** Monotonically increasing within this browser session - the actual
   * replay order. Wall-clock timestamps can tie within the same
   * millisecond; this can't. */
  readonly sequence: number;
  readonly budgetId: string;
  readonly clientTimestamp: string;
};

export type OutboxOp =
  | (OutboxOpBase & {
      readonly kind: "createTransaction";
      readonly input: Record<string, unknown>;
    })
  | (OutboxOpBase & {
      readonly kind: "updateTransaction";
      readonly transactionId: string;
      readonly input: Record<string, unknown>;
      readonly expectedUpdatedAt: string;
    })
  | (OutboxOpBase & {
      readonly kind: "deleteTransaction";
      readonly transactionId: string;
      readonly expectedUpdatedAt: string;
    })
  | (OutboxOpBase & {
      readonly kind: "assignCategory";
      readonly categoryId: string;
      readonly month: string;
      readonly amountInput: string;
      readonly expectedUpdatedAt: string | undefined;
    });

export type ConflictEntry = {
  readonly id: string;
  readonly op: OutboxOp;
  readonly reason: string;
  readonly queuedAt: string;
};

/** Tiny per-budget bookkeeping - currently just the last-seen change
 * signature, so `syncNow` can skip a full snapshot re-pull when nothing on
 * the server has actually changed. */
type SyncMeta = { readonly budgetId: string; readonly changeSignature: string };

type OfflineDBSchema = DBSchema & {
  snapshot: { key: string; value: OfflineSnapshot };
  outbox: { key: string; value: OutboxOp; indexes: { budgetId: string } };
  conflicts: { key: string; value: ConflictEntry; indexes: { budgetId: string } };
  meta: { key: string; value: SyncMeta };
};

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

export const getOfflineDb = (): Promise<IDBPDatabase<OfflineDBSchema>> => {
  dbPromise ??= openDB<OfflineDBSchema>("budgie-offline", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("snapshot");
        const outbox = db.createObjectStore("outbox", { keyPath: "id" });
        outbox.createIndex("budgetId", "budgetId");
        const conflicts = db.createObjectStore("conflicts", { keyPath: "id" });
        conflicts.createIndex("budgetId", "op.budgetId");
      }
      if (oldVersion < 2) {
        db.createObjectStore("meta", { keyPath: "budgetId" });
      }
    },
  });
  return dbPromise;
};
