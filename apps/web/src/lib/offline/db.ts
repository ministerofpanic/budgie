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

type OfflineDBSchema = DBSchema & {
  snapshot: { key: string; value: OfflineSnapshot };
  outbox: { key: string; value: OutboxOp; indexes: { budgetId: string } };
  conflicts: { key: string; value: ConflictEntry; indexes: { budgetId: string } };
};

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

export const getOfflineDb = (): Promise<IDBPDatabase<OfflineDBSchema>> => {
  dbPromise ??= openDB<OfflineDBSchema>("budgie-offline", 1, {
    upgrade(db) {
      db.createObjectStore("snapshot");
      const outbox = db.createObjectStore("outbox", { keyPath: "id" });
      outbox.createIndex("budgetId", "budgetId");
      const conflicts = db.createObjectStore("conflicts", { keyPath: "id" });
      conflicts.createIndex("budgetId", "op.budgetId");
    },
  });
  return dbPromise;
};
