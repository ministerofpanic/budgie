"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { Check, Lock, Upload } from "lucide-react";

import { format, unsafePence } from "@budgie/core/money";
import type { AccountRow } from "@/lib/dal/accounts";
import type { TransactionRow } from "@/lib/dal/transactions";
import {
  deleteTransactionsAction,
  setTransactionClearedAction,
} from "@/lib/actions/budget-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionForm } from "@/components/register/transaction-form";
import { ReconcileForm } from "@/components/register/reconcile-form";

const money = (pence: number) => format(unsafePence(pence));

type CategoryOption = { readonly id: string; readonly name: string };

const TransactionListRow = ({
  transaction,
  categoryOptions,
  accountId,
  selected,
  onToggleSelected,
}: {
  readonly transaction: TransactionRow;
  readonly categoryOptions: readonly CategoryOption[];
  readonly accountId: string;
  readonly selected: boolean;
  readonly onToggleSelected: (id: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleCleared = useCallback(() => {
    startTransition(() => setTransactionClearedAction([transaction.id], !transaction.cleared));
  }, [transaction.id, transaction.cleared]);

  const startEditing = useCallback(() => {
    if (!transaction.reconciled) setEditing(true);
  }, [transaction.reconciled]);
  const stopEditing = useCallback(() => setEditing(false), []);
  const handleToggleSelected = useCallback(
    () => onToggleSelected(transaction.id),
    [onToggleSelected, transaction.id],
  );

  if (editing) {
    return (
      <div className="py-2">
        <TransactionForm
          accountId={accountId}
          categoryOptions={categoryOptions}
          existing={transaction}
          onDone={stopEditing}
        />
      </div>
    );
  }

  const categoryLabel =
    transaction.splits.length > 0
      ? `Split (${String(transaction.splits.length)})`
      : (transaction.categoryName ?? "Uncategorised");

  return (
    <div className="hover:bg-accent/40 -mx-2 flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm transition-colors">
      <input
        type="checkbox"
        checked={selected}
        disabled={transaction.reconciled}
        onChange={handleToggleSelected}
        className="accent-primary size-4"
      />
      <button
        type="button"
        className="grid flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 text-left"
        onClick={startEditing}
      >
        <span className="text-muted-foreground tabular w-20">{transaction.date}</span>
        <span className="min-w-0 truncate font-medium">
          {transaction.payeeName ?? "(No payee)"}
        </span>
        <span className="tabular w-20 text-right font-medium">
          {money(transaction.amountPence)}
        </span>
        <span className="text-muted-foreground col-start-2 flex min-w-0 items-center gap-1.5 truncate text-xs">
          {categoryLabel}
          {transaction.reconciled ? (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Lock className="size-2.5" />
              Reconciled
            </Badge>
          ) : null}
        </span>
        <span className="text-muted-foreground tabular col-start-3 text-right text-xs">
          {money(transaction.runningBalance)}
        </span>
      </button>
      <button
        type="button"
        aria-label={transaction.cleared ? "Mark uncleared" : "Mark cleared"}
        disabled={pending || transaction.reconciled}
        onClick={toggleCleared}
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          transaction.cleared ? "bg-primary border-primary text-primary-foreground" : "border-input"
        }`}
      >
        {transaction.cleared ? <Check className="size-3" /> : null}
      </button>
    </div>
  );
};

const Register = ({
  account,
  transactions,
  categoryOptions,
}: {
  readonly account: AccountRow;
  readonly accounts: readonly AccountRow[];
  readonly transactions: readonly TransactionRow[];
  readonly categoryOptions: readonly CategoryOption[];
}) => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [pending, startTransition] = useTransition();
  const [bulkAction, setBulkAction] = useState<"cleared" | "uncleared" | "delete" | null>(null);

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const bulkDelete = useCallback(() => {
    setBulkAction("delete");
    startTransition(async () => {
      await deleteTransactionsAction([...selected]);
      setSelected(new Set());
    });
  }, [selected]);

  const bulkMarkCleared = useCallback(() => {
    setBulkAction("cleared");
    startTransition(async () => {
      await setTransactionClearedAction([...selected], true);
      setSelected(new Set());
    });
  }, [selected]);

  const bulkMarkUncleared = useCallback(() => {
    setBulkAction("uncleared");
    startTransition(async () => {
      await setTransactionClearedAction([...selected], false);
      setSelected(new Set());
    });
  }, [selected]);

  const toggleAddForm = useCallback(() => setShowAddForm((value) => !value), []);
  const closeAddForm = useCallback(() => setShowAddForm(false), []);
  const toggleReconcile = useCallback(() => setShowReconcile((value) => !value), []);
  const closeReconcile = useCallback(() => setShowReconcile(false), []);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xl font-semibold">{account.name}</p>
          <Badge variant="secondary" className="mt-1 capitalize">
            {account.type}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={`/accounts/${account.id}/import`}>
              <Upload className="size-3.5" />
              Import
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={toggleReconcile}>
            {showReconcile ? "Close" : "Reconcile"}
          </Button>
          <Button type="button" size="sm" onClick={toggleAddForm}>
            {showAddForm ? "Close" : "Add transaction"}
          </Button>
        </div>
      </header>

      {showReconcile ? <ReconcileForm accountId={account.id} onDone={closeReconcile} /> : null}

      {showAddForm ? (
        <TransactionForm
          accountId={account.id}
          categoryOptions={categoryOptions}
          onDone={closeAddForm}
        />
      ) : null}

      {selected.size > 0 ? (
        <div className="bg-muted flex items-center gap-2 rounded-lg p-2 text-sm">
          <span className="px-1">{selected.size} selected</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            loading={pending && bulkAction === "cleared"}
            onClick={bulkMarkCleared}
          >
            Mark cleared
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            loading={pending && bulkAction === "uncleared"}
            onClick={bulkMarkUncleared}
          >
            Mark uncleared
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            loading={pending && bulkAction === "delete"}
            onClick={bulkDelete}
          >
            Delete
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col divide-y">
        {transactions.map((transaction) => (
          <TransactionListRow
            key={transaction.id}
            transaction={transaction}
            categoryOptions={categoryOptions}
            accountId={account.id}
            selected={selected.has(transaction.id)}
            onToggleSelected={toggleSelected}
          />
        ))}
        {transactions.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No transactions yet.</p>
        ) : null}
      </div>
    </>
  );
};

export { Register };
