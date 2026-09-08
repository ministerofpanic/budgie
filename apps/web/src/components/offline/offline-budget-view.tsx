"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { computeMonth, type BudgetInput, type MonthKey } from "@budgie/budget";
import { format, unsafePence } from "@budgie/core/money";
import type { OfflineSnapshot } from "@/lib/dal/offline";
import { buildOp, queueOp } from "@/lib/offline/sync";
import { applyOpOptimistically } from "@/lib/offline/apply-op";

const money = (pence: number) => format(unsafePence(pence));

const currentMonthKey = (): MonthKey => {
  const now = new Date();
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

const toBudgetInput = (snapshot: OfflineSnapshot): BudgetInput => ({
  firstMonth: snapshot.firstMonth.slice(0, 7) as MonthKey,
  accounts: snapshot.accounts.map((a) => ({ id: a.id, onBudget: a.onBudget })),
  categories: snapshot.categories.map((c) => ({
    id: c.id,
    role: c.isInflow
      ? { kind: "inflow" as const }
      : c.paymentForAccountId
        ? { kind: "payment" as const, accountId: c.paymentForAccountId }
        : { kind: "normal" as const },
  })),
  assignments: snapshot.assignments.map((a) => ({
    categoryId: a.categoryId,
    month: a.month.slice(0, 7) as MonthKey,
    assignedPence: unsafePence(a.assignedPence),
  })),
  transactions: snapshot.transactions
    .filter((t) => t.categoryId)
    .map((t) => ({
      kind: "category" as const,
      id: t.id,
      accountId: t.accountId,
      date: t.date,
      entries: [{ categoryId: t.categoryId!, amountPence: unsafePence(t.amountPence) }],
    })),
});

const CategoryRow = ({
  categoryId,
  name,
  assigned,
  available,
  pending,
  onAssign,
}: {
  readonly categoryId: string;
  readonly name: string;
  readonly assigned: number;
  readonly available: number;
  readonly pending: boolean;
  readonly onAssign: (categoryId: string, value: string) => void;
}) => {
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => onAssign(categoryId, e.target.value),
    [categoryId, onAssign],
  );

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <span className="text-sm">{name}</span>
      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          disabled={pending}
          defaultValue={(assigned / 100).toFixed(2)}
          onBlur={handleBlur}
          className="w-20 rounded border px-2 py-1 text-right text-sm tabular"
        />
        <span className="tabular w-20 text-right text-sm">{money(available)}</span>
      </div>
    </div>
  );
};

const OfflineBudgetView = ({
  snapshot: initialSnapshot,
  onChange,
}: {
  readonly snapshot: OfflineSnapshot;
  readonly onChange: (snapshot: OfflineSnapshot) => void;
}) => {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pending, startTransition] = useTransition();
  const month = currentMonthKey();

  const result = useMemo(() => computeMonth(toBudgetInput(snapshot), month), [snapshot, month]);
  const resultByCategory = useMemo(
    () => new Map(result.categories.map((row) => [row.categoryId, row])),
    [result],
  );

  const assign = useCallback(
    (categoryId: string, value: string) => {
      const existing = snapshot.assignments.find(
        (a) => a.categoryId === categoryId && a.month.slice(0, 7) === month,
      );
      const op = buildOp(snapshot.budgetId, {
        kind: "assignCategory",
        categoryId,
        month,
        amountInput: value,
        expectedUpdatedAt: existing?.updatedAt,
      });
      startTransition(async () => {
        await queueOp(op);
        const next = applyOpOptimistically(snapshot, op);
        setSnapshot(next);
        onChange(next);
      });
    },
    [snapshot, month, onChange],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted flex items-center justify-between rounded-xl border p-4">
        <span className="text-sm font-medium">Ready to assign (offline)</span>
        <span className="tabular text-lg font-semibold">{money(result.readyToAssign)}</span>
      </div>
      <p className="text-muted-foreground text-xs">
        You&apos;re offline - showing the last synced data for {month}. Changes here queue up and
        sync automatically once you&apos;re back online.
      </p>
      {snapshot.categoryGroups
        .filter((group) => !group.hidden)
        .map((group) => (
          <div key={group.id} className="rounded-xl border p-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              {group.name}
            </p>
            <div className="flex flex-col divide-y">
              {snapshot.categories
                .filter((c) => c.groupId === group.id && !c.hidden)
                .map((category) => {
                  const row = resultByCategory.get(category.id);
                  return (
                    <CategoryRow
                      key={category.id}
                      categoryId={category.id}
                      name={category.name}
                      assigned={row?.assigned ?? 0}
                      available={row?.available ?? 0}
                      pending={pending}
                      onAssign={assign}
                    />
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
};

export { OfflineBudgetView };
