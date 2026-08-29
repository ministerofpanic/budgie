"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";

import { format, unsafePence } from "@budgie/core/money";
import type { AccountRow } from "@/lib/dal/accounts";
import type { TransactionRow } from "@/lib/dal/transactions";
import {
  deleteTransactionsAction,
  setTransactionClearedAction,
} from "@/lib/actions/budget-actions";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/register/transaction-form";

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

  const startEditing = useCallback(() => setEditing(true), []);
  const stopEditing = useCallback(() => setEditing(false), []);
  const handleToggleSelected = useCallback(
    () => onToggleSelected(transaction.id),
    [onToggleSelected, transaction.id],
  );

  if (editing) {
    return (
      <TransactionForm
        accountId={accountId}
        categoryOptions={categoryOptions}
        existing={transaction}
        onDone={stopEditing}
      />
    );
  }

  const categoryLabel =
    transaction.splits.length > 0
      ? `Split (${String(transaction.splits.length)})`
      : (transaction.categoryName ?? "Uncategorised");

  return (
    <div className="flex items-center gap-2 border-b py-2 text-sm">
      <input type="checkbox" checked={selected} onChange={handleToggleSelected} />
      <button
        type="button"
        className="grid flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 text-left"
        onClick={startEditing}
      >
        <span className="text-muted-foreground w-20 tabular">{transaction.date}</span>
        <span className="truncate font-medium">{transaction.payeeName ?? "(No payee)"}</span>
        <span className="tabular w-20 text-right">{money(transaction.amountPence)}</span>
        <span className="text-muted-foreground col-start-2 truncate text-xs">{categoryLabel}</span>
        <span className="text-muted-foreground col-start-3 text-right text-xs tabular">
          {money(transaction.runningBalance)}
        </span>
      </button>
      <button
        type="button"
        aria-label={transaction.cleared ? "Mark uncleared" : "Mark cleared"}
        disabled={pending}
        onClick={toggleCleared}
        className={`size-5 shrink-0 rounded border text-xs ${
          transaction.cleared ? "bg-primary text-primary-foreground" : ""
        }`}
      >
        {transaction.cleared ? "✓" : ""}
      </button>
    </div>
  );
};

const Register = ({
  account,
  accounts,
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
  const [pending, startTransition] = useTransition();

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const bulkDelete = useCallback(() => {
    startTransition(async () => {
      await deleteTransactionsAction([...selected]);
      setSelected(new Set());
    });
  }, [selected]);

  const bulkMarkCleared = useCallback(() => {
    startTransition(async () => {
      await setTransactionClearedAction([...selected], true);
      setSelected(new Set());
    });
  }, [selected]);

  const bulkMarkUncleared = useCallback(() => {
    startTransition(async () => {
      await setTransactionClearedAction([...selected], false);
      setSelected(new Set());
    });
  }, [selected]);

  const toggleAddForm = useCallback(() => setShowAddForm((value) => !value), []);
  const closeAddForm = useCallback(() => setShowAddForm(false), []);

  return (
    <>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">{account.name}</p>
          <nav className="flex gap-3 text-sm">
            <Link href="/budget" className="underline">
              Budget
            </Link>
            {accounts
              .filter((other) => other.id !== account.id)
              .map((other) => (
                <Link key={other.id} href={`/accounts/${other.id}`} className="underline">
                  {other.name}
                </Link>
              ))}
          </nav>
        </div>
        <Button type="button" size="sm" onClick={toggleAddForm}>
          {showAddForm ? "Close" : "Add transaction"}
        </Button>
      </header>

      {showAddForm ? (
        <TransactionForm
          accountId={account.id}
          categoryOptions={categoryOptions}
          onDone={closeAddForm}
        />
      ) : null}

      {selected.size > 0 ? (
        <div className="bg-muted flex items-center gap-2 rounded-md p-2 text-sm">
          <span>{selected.size} selected</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={bulkMarkCleared}
          >
            Mark cleared
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={bulkMarkUncleared}
          >
            Mark uncleared
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={bulkDelete}
          >
            Delete
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col">
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
