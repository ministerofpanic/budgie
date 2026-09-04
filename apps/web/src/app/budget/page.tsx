import { compareMonths } from "@budgie/budget";

import { getBudgetMonth } from "@/lib/dal/budget-month";
import { listMemberships, requireBudget } from "@/lib/dal/budget";
import { listAccounts } from "@/lib/dal/accounts";
import { BudgetGrid } from "@/components/budget/budget-grid";

const currentMonthKey = (): string => {
  const now = new Date();
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

const inviteMessage: Record<string, string> = {
  "already-a-member": "You're already a member of that budget.",
  "invalid-or-expired": "That invite link is invalid or has expired.",
};

const BudgetPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly month?: string; readonly invite?: string }>;
}) => {
  const { month: monthParam, invite } = await searchParams;
  const { budgetId, firstMonth } = await requireBudget();
  const requested = monthParam ?? currentMonthKey();
  const budgetFirstMonth = firstMonth.slice(0, 7);
  const month = compareMonths(requested, budgetFirstMonth) < 0 ? budgetFirstMonth : requested;

  const [view, accounts, memberships] = await Promise.all([
    getBudgetMonth(month),
    listAccounts(),
    listMemberships(),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      {invite && inviteMessage[invite] ? (
        <p className="text-muted-foreground rounded-lg border p-3 text-sm">
          {inviteMessage[invite]}
        </p>
      ) : null}
      <BudgetGrid
        view={view}
        accounts={accounts}
        memberships={memberships}
        activeBudgetId={budgetId}
      />
    </main>
  );
};

export default BudgetPage;
