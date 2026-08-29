"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { nextMonth, previousMonth } from "@budgie/budget";
import { format, unsafePence } from "@budgie/core/money";
import type { AccountRow } from "@/lib/dal/accounts";
import type { BudgetMonthView } from "@/lib/dal/budget-month";
import {
  assignCategoryAction,
  createCategoryAction,
  createCategoryGroupAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
  renameCategoryGroupAction,
  setCategoryHiddenAction,
} from "@/lib/actions/budget-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const money = (pence: number) => format(unsafePence(pence));

type NamedOption = { readonly id: string; readonly name: string };

const AssignInput = ({
  categoryId,
  month,
  initial,
}: {
  readonly categoryId: string;
  readonly month: string;
  readonly initial: number;
}) => {
  const [value, setValue] = useState(() => (initial / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const commit = useCallback(() => {
    startTransition(async () => {
      const result = await assignCategoryAction(categoryId, month, value);
      if (!result.ok) {
        setError("Not a valid amount");
        return;
      }
      setError(null);
      setValue((result.value / 100).toFixed(2));
    });
  }, [categoryId, month, value]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
    [],
  );

  return (
    <div className="flex flex-col items-end">
      <Input
        inputMode="decimal"
        className="h-8 w-24 text-right tabular"
        value={value}
        disabled={pending}
        onChange={handleChange}
        onBlur={commit}
      />
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
};

const CategoryManagePanel = ({
  categoryId,
  currentName,
  allCategories,
}: {
  readonly categoryId: string;
  readonly currentName: string;
  readonly allCategories: readonly NamedOption[];
}) => {
  const reassignOptions = useMemo(
    () => allCategories.filter((other) => other.id !== categoryId),
    [allCategories, categoryId],
  );

  const [name, setName] = useState(currentName);
  const [reassignTo, setReassignTo] = useState(reassignOptions[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );
  const handleReassignToChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => setReassignTo(event.target.value),
    [],
  );
  const handleRename = useCallback(() => {
    startTransition(() => renameCategoryAction(categoryId, name));
  }, [categoryId, name]);
  const handleMoveUp = useCallback(() => {
    startTransition(() => moveCategoryAction(categoryId, "up"));
  }, [categoryId]);
  const handleMoveDown = useCallback(() => {
    startTransition(() => moveCategoryAction(categoryId, "down"));
  }, [categoryId]);
  const handleHide = useCallback(() => {
    startTransition(() => setCategoryHiddenAction(categoryId, true));
  }, [categoryId]);
  const handleDelete = useCallback(() => {
    startTransition(() => deleteCategoryAction(categoryId, reassignTo));
  }, [categoryId, reassignTo]);

  return (
    <details className="text-muted-foreground text-xs">
      <summary className="cursor-pointer select-none">Manage</summary>
      <div className="flex flex-col gap-2 py-2">
        <div className="flex gap-2">
          <Input className="h-8" value={name} onChange={handleNameChange} />
          <Button type="button" size="sm" disabled={pending} onClick={handleRename}>
            Rename
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={handleMoveUp}
          >
            Move up
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={handleMoveDown}
          >
            Move down
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleHide}>
            Hide
          </Button>
        </div>
        {reassignOptions.length > 0 ? (
          <div className="flex gap-2">
            <select
              className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
              value={reassignTo}
              onChange={handleReassignToChange}
            >
              {reassignOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending || !reassignTo}
              onClick={handleDelete}
            >
              Delete, move money to{" "}
              {reassignOptions.find((option) => option.id === reassignTo)?.name}
            </Button>
          </div>
        ) : null}
      </div>
    </details>
  );
};

const AddCategoryForm = ({ groupId }: { readonly groupId: string }) => {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      startTransition(async () => {
        await createCategoryAction(groupId, name);
        setName("");
      });
    },
    [groupId, name],
  );

  return (
    <form onSubmit={submit} className="flex gap-2 py-1">
      <Input placeholder="New category" className="h-8" value={name} onChange={handleNameChange} />
      <Button type="submit" size="sm" variant="outline" disabled={pending || !name.trim()}>
        Add
      </Button>
    </form>
  );
};

const AddGroupForm = () => {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      startTransition(async () => {
        await createCategoryGroupAction(name);
        setName("");
      });
    },
    [name],
  );

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input placeholder="New group" className="h-9" value={name} onChange={handleNameChange} />
      <Button type="submit" variant="outline" disabled={pending || !name.trim()}>
        Add group
      </Button>
    </form>
  );
};

const GroupNameRow = ({ groupId, name }: { readonly groupId: string; readonly name: string }) => {
  const [value, setValue] = useState(name);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const startEditing = useCallback(() => setEditing(true), []);
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
    [],
  );
  const handleBlur = useCallback(() => {
    setEditing(false);
    if (value.trim() && value !== name) {
      startTransition(() => renameCategoryGroupAction(groupId, value));
    }
  }, [groupId, value, name]);

  if (!editing) {
    return (
      <button
        type="button"
        className="text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase"
        onClick={startEditing}
      >
        {name}
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        className="h-7 text-xs"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={pending}
        autoFocus
      />
    </div>
  );
};

const CategoryGroupSection = ({
  group,
  month,
  allCategories,
}: {
  readonly group: BudgetMonthView["groups"][number];
  readonly month: string;
  readonly allCategories: readonly NamedOption[];
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <GroupNameRow groupId={group.id} name={group.name} />
    </div>
    <div className="flex flex-col divide-y">
      {group.categories
        .filter((category) => !category.hidden)
        .map((category) => (
          <div key={category.id} className="flex flex-col gap-1 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{category.name}</p>
              <div className="flex items-center gap-3">
                <AssignInput categoryId={category.id} month={month} initial={category.assigned} />
                <span className="tabular text-muted-foreground w-20 text-right text-sm">
                  {money(category.activity)}
                </span>
                <span
                  className={`tabular w-20 text-right text-sm font-medium ${
                    category.available < 0 ? "text-money-negative" : "text-money-positive"
                  }`}
                >
                  {money(category.available)}
                </span>
              </div>
            </div>
            <CategoryManagePanel
              categoryId={category.id}
              currentName={category.name}
              allCategories={allCategories}
            />
          </div>
        ))}
    </div>
    <AddCategoryForm groupId={group.id} />
  </div>
);

const BudgetGrid = ({
  view,
  accounts,
}: {
  readonly view: BudgetMonthView;
  readonly accounts: readonly AccountRow[];
}) => {
  const router = useRouter();
  const allCategories = useMemo(
    () =>
      view.groups.flatMap((group) =>
        group.categories.map((category) => ({ id: category.id, name: category.name })),
      ),
    [view.groups],
  );
  const refresh = useCallback(() => router.refresh(), [router]);

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href={`/budget?month=${previousMonth(view.month)}`} className="text-sm underline">
            &larr; Prev
          </Link>
          <p className="text-lg font-semibold">{view.month}</p>
          <Link href={`/budget?month=${nextMonth(view.month)}`} className="text-sm underline">
            Next &rarr;
          </Link>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs uppercase">Ready to assign</p>
          <p
            className={`tabular text-2xl font-semibold ${
              view.readyToAssign < 0 ? "text-money-negative" : "text-money-positive"
            }`}
          >
            {money(view.readyToAssign)}
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-3 text-sm">
        {accounts.map((account) => (
          <Link key={account.id} href={`/accounts/${account.id}`} className="underline">
            {account.name}
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-6">
        {view.groups.map((group) => (
          <CategoryGroupSection
            key={group.id}
            group={group}
            month={view.month}
            allCategories={allCategories}
          />
        ))}
        <AddGroupForm />
      </section>

      <Button type="button" variant="ghost" size="sm" onClick={refresh}>
        Refresh
      </Button>
    </>
  );
};

export { BudgetGrid };
