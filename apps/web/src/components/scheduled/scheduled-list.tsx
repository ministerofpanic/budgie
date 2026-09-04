"use client";

import { useCallback, useState, useTransition } from "react";
import { CalendarClock, Plus, Repeat } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [activeAction, setActiveAction] = useState<"enter" | "skip" | "delete" | null>(null);

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
    setActiveAction("enter");
    startTransition(async () => {
      const result = await enterNextOccurrenceAction(row.id, undefined);
      setError(result.ok ? null : "Could not enter this transaction");
    });
  }, [row.id]);

  const handleEnterEdited = useCallback(() => {
    setActiveAction("enter");
    startTransition(async () => {
      const outflow = row.amountPence < 0;
      const amountInput = outflow ? `-${amount}` : amount;
      const result = await enterNextOccurrenceAction(row.id, { date, amountInput });
      if (result.ok) setEditing(false);
      setError(result.ok ? null : "Could not enter this transaction");
    });
  }, [row.id, row.amountPence, amount, date]);

  const handleSkip = useCallback(() => {
    setActiveAction("skip");
    startTransition(() => skipNextOccurrenceAction(row.id));
  }, [row.id]);

  const handleDelete = useCallback(() => {
    setActiveAction("delete");
    startTransition(() => deleteScheduledTransactionAction(row.id));
  }, [row.id]);

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
            <Repeat className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">{row.payeeName ?? "(no payee)"}</p>
            <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
              {row.accountName} · {row.categoryName ?? "Uncategorised"}
              <Badge variant="secondary" className="text-[10px]">
                {frequencyLabel[row.frequency]}
              </Badge>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3" />
                {row.nextDate}
              </span>
            </p>
          </div>
        </div>
        <span
          className={`tabular text-sm font-semibold ${
            row.amountPence < 0 ? "text-money-negative" : "text-money-positive"
          }`}
        >
          {money(row.amountPence)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 pl-12">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          loading={pending && activeAction === "enter"}
          onClick={handleEnter}
        >
          Enter now
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={startEditing}>
          Edit this occurrence
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          loading={pending && activeAction === "skip"}
          onClick={handleSkip}
        >
          Skip
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          loading={pending && activeAction === "delete"}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </div>
      {editing ? (
        <div className="ml-12 flex flex-wrap items-end gap-2">
          <Input type="date" className="h-8 w-36" value={date} onChange={handleDateChange} />
          <Input
            inputMode="decimal"
            className="h-8 w-24"
            value={amount}
            onChange={handleAmountChange}
          />
          <Button
            type="button"
            size="sm"
            loading={pending && activeAction === "enter"}
            onClick={handleEnterEdited}
          >
            Enter edited occurrence
          </Button>
        </div>
      ) : null}
      {error ? <span className="text-destructive ml-12 text-xs">{error}</span> : null}
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
    (value: string) => setFrequency(value as ScheduledTransactionRow["frequency"]),
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
    <form onSubmit={submit} className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <p className="text-sm font-semibold">Add a scheduled transaction</p>
      <div className="flex flex-wrap gap-2">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger>
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Select value={frequency} onValueChange={handleFrequencyChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(frequencyLabel) as ScheduledTransactionRow["frequency"][]).map(
              (option) => (
                <SelectItem key={option} value={option}>
                  {frequencyLabel[option]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Input type="date" className="w-36" value={nextDate} onChange={handleNextDateChange} />
      </div>
      <Button type="submit" disabled={!outflow && !inflow} loading={pending}>
        <Plus className="size-4" />
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
    <h1 className="text-xl font-semibold">Scheduled transactions</h1>
    <div className="flex flex-col divide-y rounded-xl border px-4">
      {upcoming.map((row) => (
        <ScheduledRow key={row.id} row={row} />
      ))}
      {upcoming.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">Nothing scheduled yet.</p>
      ) : null}
    </div>
    <AddScheduledForm accounts={accounts} categoryOptions={categoryOptions} />
  </>
);

export { ScheduledList };
