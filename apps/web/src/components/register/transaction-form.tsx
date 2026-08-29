"use client";

import { useCallback, useId, useState, useTransition } from "react";

import type { TransactionRow } from "@/lib/dal/transactions";
import { createTransactionAction, updateTransactionAction } from "@/lib/actions/budget-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CategoryOption = { readonly id: string; readonly name: string };

type SplitRow = {
  readonly rowId: string;
  readonly categoryId: string;
  readonly amountInput: string;
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const errorMessage = {
  "invalid-amount": "Enter a valid amount.",
  "amount-required": "Enter an outflow or an inflow.",
  "splits-dont-match-total": "Splits must add up to the total.",
  "category-required": "Choose a category, or split across several.",
  "reconciled-locked": "This transaction is reconciled and locked - it can't be edited.",
} as const;

const SplitRowFields = ({
  row,
  categoryOptions,
  onCategoryChange,
  onAmountChange,
}: {
  readonly row: SplitRow;
  readonly categoryOptions: readonly CategoryOption[];
  readonly onCategoryChange: (rowId: string, categoryId: string) => void;
  readonly onAmountChange: (rowId: string, amountInput: string) => void;
}) => {
  const handleCategoryChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) =>
      onCategoryChange(row.rowId, event.target.value),
    [row.rowId, onCategoryChange],
  );
  const handleAmountChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onAmountChange(row.rowId, event.target.value),
    [row.rowId, onAmountChange],
  );

  return (
    <div className="flex gap-2">
      <select
        className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
        value={row.categoryId}
        onChange={handleCategoryChange}
      >
        {categoryOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <Input
        inputMode="decimal"
        className="w-24"
        value={row.amountInput}
        onChange={handleAmountChange}
      />
    </div>
  );
};

const TransactionForm = ({
  accountId,
  categoryOptions,
  existing,
  onDone,
}: {
  readonly accountId: string;
  readonly categoryOptions: readonly CategoryOption[];
  readonly existing?: TransactionRow | undefined;
  readonly onDone?: (() => void) | undefined;
}) => {
  const formId = useId();
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [payeeName, setPayeeName] = useState(existing?.payeeName ?? "");
  const [memo, setMemo] = useState(existing?.memo ?? "");
  const [cleared, setCleared] = useState(existing?.cleared ?? false);
  const [outflow, setOutflow] = useState(
    existing && existing.amountPence < 0 ? (-existing.amountPence / 100).toFixed(2) : "",
  );
  const [inflow, setInflow] = useState(
    existing && existing.amountPence > 0 ? (existing.amountPence / 100).toFixed(2) : "",
  );
  const [split, setSplit] = useState((existing?.splits.length ?? 0) > 0);
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId ?? categoryOptions[0]?.id ?? "",
  );
  const [splits, setSplits] = useState<SplitRow[]>(
    existing?.splits.map((row, index) => ({
      rowId: `${formId}-${String(index)}`,
      categoryId: row.categoryId,
      amountInput: (row.amountPence / 100).toFixed(2),
    })) ?? [],
  );
  const [nextRowNumber, setNextRowNumber] = useState(splits.length);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setDate(event.target.value),
    [],
  );
  const handlePayeeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setPayeeName(event.target.value),
    [],
  );
  const handleMemoChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setMemo(event.target.value),
    [],
  );
  const handleClearedChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setCleared(event.target.checked),
    [],
  );
  const handleSplitToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setSplit(event.target.checked),
    [],
  );
  const handleCategoryChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => setCategoryId(event.target.value),
    [],
  );
  const handleOutflowChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setOutflow(event.target.value);
    if (event.target.value) setInflow("");
  }, []);
  const handleInflowChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInflow(event.target.value);
    if (event.target.value) setOutflow("");
  }, []);

  const addSplitRow = useCallback(() => {
    setSplits((rows) => [
      ...rows,
      {
        rowId: `${formId}-${String(nextRowNumber)}`,
        categoryId: categoryOptions[0]?.id ?? "",
        amountInput: "",
      },
    ]);
    setNextRowNumber((n) => n + 1);
  }, [formId, nextRowNumber, categoryOptions]);

  const updateSplitCategory = useCallback((rowId: string, value: string) => {
    setSplits((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, categoryId: value } : row)),
    );
  }, []);

  const updateSplitAmount = useCallback((rowId: string, value: string) => {
    setSplits((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, amountInput: value } : row)),
    );
  }, []);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      const input = {
        accountId,
        date,
        payeeName: payeeName || undefined,
        memo: memo || undefined,
        cleared,
        outflowInput: outflow || undefined,
        inflowInput: inflow || undefined,
        categoryId: split ? undefined : categoryId || undefined,
        splits: split
          ? splits.map(({ categoryId: c, amountInput }) => ({ categoryId: c, amountInput }))
          : undefined,
      };

      startTransition(async () => {
        const result = existing
          ? await updateTransactionAction(existing.id, input)
          : await createTransactionAction(input);

        if (!result.ok) {
          setError(errorMessage[result.error.kind]);
          return;
        }

        onDone?.();
        if (!existing) {
          setPayeeName("");
          setMemo("");
          setOutflow("");
          setInflow("");
          setSplits([]);
        }
      });
    },
    [
      accountId,
      date,
      payeeName,
      memo,
      cleared,
      outflow,
      inflow,
      split,
      categoryId,
      splits,
      existing,
      onDone,
    ],
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={handleDateChange} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="payee">Payee</Label>
          <Input id="payee" value={payeeName} onChange={handlePayeeChange} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="outflow">Outflow</Label>
          <Input id="outflow" inputMode="decimal" value={outflow} onChange={handleOutflowChange} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="inflow">Inflow</Label>
          <Input id="inflow" inputMode="decimal" value={inflow} onChange={handleInflowChange} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={split} onChange={handleSplitToggle} />
        Split across categories
      </label>

      {split ? (
        <div className="flex flex-col gap-2">
          {splits.map((row) => (
            <SplitRowFields
              key={row.rowId}
              row={row}
              categoryOptions={categoryOptions}
              onCategoryChange={updateSplitCategory}
              onAmountChange={updateSplitAmount}
            />
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addSplitRow}>
            Add split
          </Button>
        </div>
      ) : (
        <select
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          value={categoryId}
          onChange={handleCategoryChange}
        >
          {categoryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="memo">Memo</Label>
        <Input id="memo" value={memo} onChange={handleMemoChange} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cleared} onChange={handleClearedChange} />
        Cleared
      </label>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {existing ? "Save" : "Add transaction"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
};

export { TransactionForm };
