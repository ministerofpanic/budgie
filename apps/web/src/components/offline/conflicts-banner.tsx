"use client";

import { useCallback, useTransition } from "react";
import type { ConflictEntry } from "@/lib/offline/db";
import { discardConflict, retryConflictForcingLocal } from "@/lib/offline/sync";

const describeOp = (op: ConflictEntry["op"]): string => {
  switch (op.kind) {
    case "createTransaction":
      return "adding a transaction";
    case "updateTransaction":
      return "editing a transaction";
    case "deleteTransaction":
      return "deleting a transaction";
    case "assignCategory":
      return `assigning ${op.amountInput} to a category`;
  }
};

const ConflictRow = ({
  entry,
  onKeepMine,
  onDiscardMine,
}: {
  readonly entry: ConflictEntry;
  readonly onKeepMine: (id: string) => void;
  readonly onDiscardMine: (id: string) => void;
}) => {
  const handleKeepMine = useCallback(() => onKeepMine(entry.id), [entry.id, onKeepMine]);
  const handleDiscardMine = useCallback(() => onDiscardMine(entry.id), [entry.id, onDiscardMine]);

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>{describeOp(entry.op)}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleKeepMine}
          className="rounded border px-2 py-1 text-xs font-medium"
        >
          Keep mine
        </button>
        <button
          type="button"
          onClick={handleDiscardMine}
          className="text-muted-foreground rounded border px-2 py-1 text-xs font-medium"
        >
          Discard mine
        </button>
      </div>
    </div>
  );
};

const ConflictsBanner = ({
  conflicts,
  onResolved,
}: {
  readonly conflicts: readonly ConflictEntry[];
  readonly onResolved: () => void;
}) => {
  const [, startTransition] = useTransition();

  const keepMine = useCallback(
    (id: string) => {
      startTransition(async () => {
        await retryConflictForcingLocal(id);
        onResolved();
      });
    },
    [onResolved],
  );

  const discardMine = useCallback(
    (id: string) => {
      startTransition(async () => {
        await discardConflict(id);
        onResolved();
      });
    },
    [onResolved],
  );

  if (conflicts.length === 0) return null;

  return (
    <div className="bg-destructive/10 border-destructive/30 flex flex-col gap-2 rounded-xl border p-4">
      <p className="text-sm font-medium">
        {conflicts.length} change{conflicts.length === 1 ? "" : "s"} made offline couldn&apos;t sync
        - someone else edited the same data first.
      </p>
      <div className="flex flex-col gap-2">
        {conflicts.map((entry) => (
          <ConflictRow
            key={entry.id}
            entry={entry}
            onKeepMine={keepMine}
            onDiscardMine={discardMine}
          />
        ))}
      </div>
    </div>
  );
};

export { ConflictsBanner };
