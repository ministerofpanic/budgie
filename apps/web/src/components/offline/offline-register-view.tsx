"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { format, unsafePence } from "@budgie/core/money";
import type { OfflineSnapshot } from "@/lib/dal/offline";
import { buildOp, queueOp } from "@/lib/offline/sync";
import { applyOpOptimistically } from "@/lib/offline/apply-op";

const money = (pence: number) => format(unsafePence(pence));
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const OfflineRegisterView = ({
  snapshot: initialSnapshot,
  accountId,
  onChange,
}: {
  readonly snapshot: OfflineSnapshot;
  readonly accountId: string;
  readonly onChange: (snapshot: OfflineSnapshot) => void;
}) => {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [date, setDate] = useState(todayIso());
  const [outflow, setOutflow] = useState("");
  const [inflow, setInflow] = useState("");
  const [memo, setMemo] = useState("");
  const [categoryId, setCategoryId] = useState(snapshot.categories[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const account = snapshot.accounts.find((a) => a.id === accountId);
  const transactions = useMemo(
    () =>
      snapshot.transactions
        .filter((t) => t.accountId === accountId)
        .toSorted((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [snapshot, accountId],
  );

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const op = buildOp(snapshot.budgetId, {
        kind: "createTransaction",
        input: {
          accountId,
          date,
          memo: memo || undefined,
          cleared: false,
          outflowInput: outflow || undefined,
          inflowInput: inflow || undefined,
          categoryId: categoryId || undefined,
        },
      });
      startTransition(async () => {
        await queueOp(op);
        const next = applyOpOptimistically(snapshot, op);
        setSnapshot(next);
        onChange(next);
        setOutflow("");
        setInflow("");
        setMemo("");
      });
    },
    [snapshot, accountId, date, memo, outflow, inflow, categoryId, onChange],
  );

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value),
    [],
  );
  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setCategoryId(e.target.value),
    [],
  );
  const handleOutflowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOutflow(e.target.value);
    if (e.target.value) setInflow("");
  }, []);
  const handleInflowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInflow(e.target.value);
    if (e.target.value) setOutflow("");
  }, []);
  const handleMemoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setMemo(e.target.value),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">
        You&apos;re offline - showing {account?.name ?? "this account"}&apos;s last synced
        transactions. New entries queue up and sync automatically once you&apos;re back online.
      </p>

      <form
        onSubmit={submit}
        className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm"
      >
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={date}
            onChange={handleDateChange}
            className="rounded border px-2 py-1 text-sm"
          />
          <select
            value={categoryId}
            onChange={handleCategoryChange}
            className="rounded border px-2 py-1 text-sm"
          >
            {snapshot.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            inputMode="decimal"
            placeholder="Outflow"
            value={outflow}
            onChange={handleOutflowChange}
            className="rounded border px-2 py-1 text-sm"
          />
          <input
            inputMode="decimal"
            placeholder="Inflow"
            value={inflow}
            onChange={handleInflowChange}
            className="rounded border px-2 py-1 text-sm"
          />
        </div>
        <input
          placeholder="Memo"
          value={memo}
          onChange={handleMemoChange}
          className="rounded border px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending || (!outflow && !inflow)}
          className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Add transaction (queued offline)
        </button>
      </form>

      <div className="flex flex-col divide-y">
        {transactions.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="text-muted-foreground tabular w-20">{t.date}</span>
            <span className="flex-1 truncate">{t.memo ?? "—"}</span>
            <span className="tabular w-20 text-right font-medium">{money(t.amountPence)}</span>
            <span className="text-muted-foreground tabular w-20 text-right text-xs">
              {money(t.runningBalancePence)}
            </span>
          </div>
        ))}
        {transactions.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">No cached transactions yet.</p>
        ) : null}
      </div>
    </div>
  );
};

export { OfflineRegisterView };
