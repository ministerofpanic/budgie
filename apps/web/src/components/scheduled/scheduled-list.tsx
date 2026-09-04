"use client";

import { useCallback, useState, useTransition } from "react";

import { format, unsafePence } from "@budgie/core/money";
import type { AccountRow } from "@/lib/dal/accounts";
import type { ScheduledTransactionRow } from "@/lib/dal/scheduled-transactions";
import {
  createScheduledTransactionAction,
  deleteScheduledTransactionAction,
  enterNextOccurrenceAction,
  skipNextOccurrenceAction,
} from "@/lib/actions/scheduled-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const money = (pence: number) => format(unsafePence(pence));

type CategoryOption = { readonly id: string; readonly name: string };

const frequencyLabel: Record<ScheduledTransactionRow["frequency"], string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const ScheduledRow = ({ row }: { readonly row: ScheduledTransactionRow }) => {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(() => (row.amountPence / 100).toFixed(2));
  const [date, setDate] = useState(row.nextDate);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleAmountChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setAmount(event.target.value),
    [],
  );
  const handleDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setDate(event.target.value),
    [],
  );
  const startEditing = useCallback(() => setEditing(true), []);

  const handleEnter = useCallback(() => {
    startTransition(async () => {
      const result = await enterNextOccurrenceAction(row.id, undefined);
      setError(result.ok ? null : "Could not enter this transaction");
    });
  }, [row.id]);

  const handleEnterEdited = useCallback(() => {
    startTransition(async () => {
      const outflow = row.amountPence < 0;
      const amountInput = outflow ? `-${amount}` : amount;
      const result = await enterNextOccurrenceAction(row.id, { date, amountInput });
      if (result.ok) setEditing(false);
      setError(result.ok ? null : "Could not enter this transaction");
    });
  }, [row.id, row.amountPence, amount, date]);

  const handleSkip = useCallback(() => {
    startTransition(() => skipNextOccurrenceAction(row.id));
  }, [row.id]);

  const handleDelete = useCallback(() => {
    startTransition(() => deleteScheduledTransactionAction(row.id));
  }, [row.id]);

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{row.payeeName ?? "(no payee)"}</p>
          <p className="text-muted-foreground text-xs">
            {row.accountName} · {row.categoryName ?? "Uncategorised"} ·{" "}
            {frequencyLabel[row.frequency]} · next {row.nextDate}
          </p>
        </div>
        <span
          className={`tabular text-sm font-medium ${
            row.amountPence < 0 ? "text-money-negative" : "text-money-positive"
          }`}
        >
          {money(row.amountPence)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={handleEnter}>
          Enter now
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={startEditing}>
          Edit this occurrence
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleSkip}>
          Skip
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </div>
      {editing ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input type="date" className="h-8 w-36" value={date} onChange={handleDateChange} />
          <Input
            inputMode="decimal"
            className="h-8 w-24"
            value={amount}
            onChange={handleAmountChange}
          />
          <Button type="button" size="sm" disabled={pending} onClick={handleEnterEdited}>
            Enter edited occurrence
          </Button>
        </div>
      ) : null}
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
};

const AddScheduledForm = ({
  accounts,
  categoryOptions,
}: {
  readonly accounts: readonly AccountRow[];
  readonly categoryOptions: readonly CategoryOption[];
}) => {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categoryOptions[0]?.id ?? "");
  const [payeeName, setPayeeName] = useState("");
  const [outflow, setOutflow] = useState("");
  const [inflow, setInflow] = useState("");
  const [frequency, setFrequency] = useState<ScheduledTransactionRow["frequency"]>("monthly");
  const [nextDate, setNextDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleAccountChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => setAccountId(event.target.value),
    [],
  );
  const handleCategoryChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => setCategoryId(event.target.value),
    [],
  );
  const handlePayeeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setPayeeName(event.target.value),
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
  const handleFrequencyChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) =>
      setFrequency(event.target.value as ScheduledTransactionRow["frequency"]),
    [],
  );
  const handleNextDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setNextDate(event.target.value),
    [],
  );

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      startTransition(async () => {
        const amountInput = outflow ? `-${outflow}` : inflow;
        const result = await createScheduledTransactionAction({
          accountId,
          categoryId,
          payeeName: payeeName || undefined,
          amountInput,
          frequency,
          nextDate,
        });
        if (result.ok) {
          setPayeeName("");
          setOutflow("");
          setInflow("");
          setError(null);
        } else {
          setError("Not a valid scheduled transaction");
        }
      });
    },
    [accountId, categoryId, payeeName, outflow, inflow, frequency, nextDate],
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-sm font-semibold">Add a scheduled transaction</p>
      <div className="flex flex-wrap gap-2">
        <select
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          value={accountId}
          onChange={handleAccountChange}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
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
      </div>
      <Input placeholder="Payee" value={payeeName} onChange={handlePayeeChange} />
      <div className="flex flex-wrap gap-2">
        <div>
          <Label htmlFor="scheduled-outflow">Outflow</Label>
          <Input
            id="scheduled-outflow"
            inputMode="decimal"
            value={outflow}
            onChange={handleOutflowChange}
          />
        </div>
        <div>
          <Label htmlFor="scheduled-inflow">Inflow</Label>
          <Input
            id="scheduled-inflow"
            inputMode="decimal"
            value={inflow}
            onChange={handleInflowChange}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          value={frequency}
          onChange={handleFrequencyChange}
        >
          {(Object.keys(frequencyLabel) as ScheduledTransactionRow["frequency"][]).map((option) => (
            <option key={option} value={option}>
              {frequencyLabel[option]}
            </option>
          ))}
        </select>
        <Input type="date" className="h-9 w-36" value={nextDate} onChange={handleNextDateChange} />
      </div>
      <Button type="submit" disabled={pending || (!outflow && !inflow)}>
        Add scheduled transaction
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </form>
  );
};

const ScheduledList = ({
  upcoming,
  accounts,
  categoryOptions,
}: {
  readonly upcoming: readonly ScheduledTransactionRow[];
  readonly accounts: readonly AccountRow[];
  readonly categoryOptions: readonly CategoryOption[];
}) => (
  <>
    <h1 className="text-lg font-semibold">Scheduled transactions</h1>
    <div className="flex flex-col divide-y rounded-lg border px-4">
      {upcoming.map((row) => (
        <ScheduledRow key={row.id} row={row} />
      ))}
      {upcoming.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">Nothing scheduled yet.</p>
      ) : null}
    </div>
    <AddScheduledForm accounts={accounts} categoryOptions={categoryOptions} />
  </>
);

export { ScheduledList };
