"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  PiggyBank,
  Plus,
  RefreshCw,
} from "lucide-react";

import { nextMonth, previousMonth, type Target } from "@budgie/budget";
import { format, unsafePence } from "@budgie/core/money";
import type { BudgetMonthView } from "@/lib/dal/budget-month";
import {
  assignCategoryAction,
  createCategoryAction,
  createCategoryGroupAction,
  deleteCategoryAction,
  deleteTargetAction,
  moveCategoryAction,
  renameCategoryAction,
  renameCategoryGroupAction,
  setCategoryHiddenAction,
  setTargetAction,
} from "@/lib/actions/budget-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        className="tabular h-8 w-24 text-right"
        value={value}
        disabled={pending}
        onChange={handleChange}
        onBlur={commit}
      />
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
};

const targetKindLabel: Record<Target["kind"], string> = {
  monthly: "Assign monthly",
  refill: "Refill up to",
  "by-date": "Save by date",
  spending: "Spending cap",
};

const TargetProgress = ({
  target,
  assigned,
  targetProgress,
}: {
  readonly target: Target;
  readonly assigned: number;
  readonly targetProgress: {
    readonly neededThisMonth: number;
    readonly underfundedPence: number;
    readonly met: boolean;
  };
}) => {
  const { neededThisMonth, underfundedPence, met } = targetProgress;
  const denominator =
    target.kind === "spending" ? target.amountPence : Math.max(neededThisMonth, assigned, 1);
  const numerator = target.kind === "spending" ? target.amountPence - underfundedPence : assigned;
  const percent = Math.min(100, Math.max(0, (numerator / denominator) * 100));
  const barColor = met ? "[&>div]:bg-money-positive" : "[&>div]:bg-money-warning";

  return (
    <div className="flex items-center gap-2">
      <Progress value={percent} className={`h-1.5 flex-1 ${barColor}`} />
      <span className={`text-xs ${met ? "text-money-positive" : "text-money-warning"}`}>
        {met
          ? `On track · ${targetKindLabel[target.kind]}`
          : target.kind === "spending"
            ? `${money(underfundedPence)} over cap`
            : `${money(underfundedPence)} to go`}
      </span>
    </div>
  );
};

const TargetEditor = ({
  categoryId,
  target,
}: {
  readonly categoryId: string;
  readonly target: Target | null;
}) => {
  const [kind, setKind] = useState<Target["kind"]>(target?.kind ?? "monthly");
  const [amount, setAmount] = useState(() => (target ? (target.amountPence / 100).toFixed(2) : ""));
  const [dueDate, setDueDate] = useState(target?.kind === "by-date" ? target.dueDate : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleKindChange = useCallback((value: string) => setKind(value as Target["kind"]), []);
  const handleAmountChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setAmount(event.target.value),
    [],
  );
  const handleDueDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setDueDate(event.target.value),
    [],
  );

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const input = kind === "by-date" ? { kind, amount, dueDate } : { kind, amount };
      const result = await setTargetAction(categoryId, input);
      setError(result.ok ? null : "Not a valid target");
    });
  }, [categoryId, kind, amount, dueDate]);

  const handleClear = useCallback(() => {
    startTransition(() => deleteTargetAction(categoryId));
  }, [categoryId]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium">Target</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={handleKindChange}>
          <SelectTrigger size="sm" className="bg-background w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(targetKindLabel) as Target["kind"][]).map((option) => (
              <SelectItem key={option} value={option}>
                {targetKindLabel[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          inputMode="decimal"
          placeholder="Amount"
          className="bg-background h-8 w-24"
          value={amount}
          onChange={handleAmountChange}
        />
        {kind === "by-date" ? (
          <Input
            type="date"
            className="bg-background h-8 w-36"
            value={dueDate}
            onChange={handleDueDateChange}
          />
        ) : null}
        <Button type="button" size="sm" disabled={pending || !amount} onClick={handleSave}>
          Save
        </Button>
        {target ? (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={handleClear}>
            Clear
          </Button>
        ) : null}
      </div>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
};

const CategoryEditPanel = ({
  categoryId,
  currentName,
  allCategories,
  target,
}: {
  readonly categoryId: string;
  readonly currentName: string;
  readonly allCategories: readonly NamedOption[];
  readonly target: Target | null;
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
  const handleRename = useCallback(() => {
    startTransition(() => renameCategoryAction(categoryId, name));
  }, [categoryId, name]);
  const handleDelete = useCallback(() => {
    startTransition(() => deleteCategoryAction(categoryId, reassignTo));
  }, [categoryId, reassignTo]);

  return (
    <div className="bg-muted/50 mt-2 flex flex-col gap-4 rounded-lg border p-3">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium">Name</p>
        <div className="flex gap-2">
          <Input className="bg-background h-8" value={name} onChange={handleNameChange} />
          <Button type="button" size="sm" disabled={pending} onClick={handleRename}>
            Rename
          </Button>
        </div>
      </div>

      <TargetEditor categoryId={categoryId} target={target} />

      {reassignOptions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium">Delete category</p>
          <div className="flex flex-wrap gap-2">
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger size="sm" className="bg-background w-48">
                <SelectValue placeholder="Move money to…" />
              </SelectTrigger>
              <SelectContent>
                {reassignOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending || !reassignTo}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const CategoryRowMenu = ({
  categoryId,
  editing,
  onToggleEdit,
}: {
  readonly categoryId: string;
  readonly editing: boolean;
  readonly onToggleEdit: () => void;
}) => {
  const [pending, startTransition] = useTransition();

  const handleMoveUp = useCallback(() => {
    startTransition(() => moveCategoryAction(categoryId, "up"));
  }, [categoryId]);
  const handleMoveDown = useCallback(() => {
    startTransition(() => moveCategoryAction(categoryId, "down"));
  }, [categoryId]);
  const handleHide = useCallback(() => {
    startTransition(() => setCategoryHiddenAction(categoryId, true));
  }, [categoryId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-7"
          disabled={pending}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onToggleEdit}>{editing ? "Close" : "Edit"}</DropdownMenuItem>
        <DropdownMenuItem onClick={handleMoveUp}>Move up</DropdownMenuItem>
        <DropdownMenuItem onClick={handleMoveDown}>Move down</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleHide}>Hide</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    <form onSubmit={submit} className="flex gap-2 px-1 py-2">
      <Input
        placeholder="New category"
        className="h-8 border-dashed"
        value={name}
        onChange={handleNameChange}
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || !name.trim()}>
        <Plus className="size-3.5" />
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
      <Input
        placeholder="New group"
        className="border-dashed"
        value={name}
        onChange={handleNameChange}
      />
      <Button type="submit" variant="outline" disabled={pending || !name.trim()}>
        <Plus className="size-4" />
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
        className="text-muted-foreground hover:text-foreground text-left text-xs font-semibold tracking-wide uppercase transition-colors"
        onClick={startEditing}
      >
        {name}
      </button>
    );
  }

  return (
    <Input
      className="h-7 w-48 text-xs"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={pending}
      autoFocus
    />
  );
};

const CategoryRow = ({
  category,
  month,
  allCategories,
}: {
  readonly category: BudgetMonthView["groups"][number]["categories"][number];
  readonly month: string;
  readonly allCategories: readonly NamedOption[];
}) => {
  const [editing, setEditing] = useState(false);
  const toggleEdit = useCallback(() => setEditing((current) => !current), []);

  return (
    <div className="hover:bg-accent/40 -mx-2 rounded-lg px-2 py-2.5 transition-colors">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3">
        <p className="min-w-0 truncate text-sm font-medium">{category.name}</p>
        <AssignInput categoryId={category.id} month={month} initial={category.assigned} />
        <span className="tabular text-muted-foreground w-20 text-right text-sm">
          {money(category.activity)}
        </span>
        <span
          className={`tabular w-20 text-right text-sm font-semibold ${
            category.available < 0 ? "text-money-negative" : "text-money-positive"
          }`}
        >
          {money(category.available)}
        </span>
        <CategoryRowMenu categoryId={category.id} editing={editing} onToggleEdit={toggleEdit} />
      </div>
      {category.target && category.targetProgress ? (
        <div className="mt-1.5 pr-9 pl-0">
          <TargetProgress
            target={category.target}
            assigned={category.assigned}
            targetProgress={category.targetProgress}
          />
        </div>
      ) : null}
      {editing ? (
        <CategoryEditPanel
          categoryId={category.id}
          currentName={category.name}
          allCategories={allCategories}
          target={category.target}
        />
      ) : null}
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
  <div className="flex flex-col gap-0.5">
    <GroupNameRow groupId={group.id} name={group.name} />
    <div className="flex flex-col divide-y">
      {group.categories
        .filter((category) => !category.hidden)
        .map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            month={month}
            allCategories={allCategories}
          />
        ))}
    </div>
    <AddCategoryForm groupId={group.id} />
  </div>
);

const ColumnHeaders = () => (
  <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 text-xs font-medium tracking-wide uppercase">
    <span>Category</span>
    <span className="w-24 text-right">Assigned</span>
    <span className="w-20 text-right">Activity</span>
    <span className="w-20 text-right">Available</span>
    <span className="w-7" />
  </div>
);

const MonthSwitcher = ({ month }: { readonly month: string }) => (
  <div className="border-input bg-card inline-flex items-center gap-1 rounded-full border p-1 shadow-xs">
    <Button asChild variant="ghost" size="icon" className="size-7 rounded-full">
      <Link href={`/budget?month=${previousMonth(month)}`} aria-label="Previous month">
        <ChevronLeft className="size-4" />
      </Link>
    </Button>
    <p className="tabular w-24 text-center text-sm font-semibold">{month}</p>
    <Button asChild variant="ghost" size="icon" className="size-7 rounded-full">
      <Link href={`/budget?month=${nextMonth(month)}`} aria-label="Next month">
        <ChevronRight className="size-4" />
      </Link>
    </Button>
  </div>
);

const ReadyToAssignCard = ({ readyToAssign }: { readonly readyToAssign: number }) => {
  const positive = readyToAssign >= 0;
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border p-5 ${
        positive
          ? "bg-money-positive/8 border-money-positive/20"
          : "bg-money-negative/8 border-money-negative/20"
      }`}
    >
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
          positive
            ? "bg-money-positive/15 text-money-positive"
            : "bg-money-negative/15 text-money-negative"
        }`}
      >
        <PiggyBank className="size-5" />
      </div>
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Ready to assign
        </p>
        <p
          className={`tabular text-3xl font-semibold ${
            positive ? "text-money-positive" : "text-money-negative"
          }`}
        >
          {money(readyToAssign)}
        </p>
      </div>
    </div>
  );
};

const BudgetGrid = ({ view }: { readonly view: BudgetMonthView }) => {
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
      <div className="flex items-center justify-between">
        <MonthSwitcher month={view.month} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={refresh}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <ReadyToAssignCard readyToAssign={view.readyToAssign} />

      <section className="flex flex-col gap-5">
        <ColumnHeaders />
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
    </>
  );
};

export { BudgetGrid };
