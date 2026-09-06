import type { Metadata } from "next";
import { compareMonths } from "@budgie/budget";

import { getBudgetMonth } from "@/lib/dal/budget-month";
import { requireBudget } from "@/lib/dal/budget";
import { BudgetGrid } from "@/components/budget/budget-grid";

export const metadata: Metadata = { title: "Budget" };

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
  const { firstMonth } = await requireBudget();
  const requested = monthParam ?? currentMonthKey();
  const budgetFirstMonth = firstMonth.slice(0, 7);
  const month = compareMonths(requested, budgetFirstMonth) < 0 ? budgetFirstMonth : requested;

  const view = await getBudgetMonth(month);

  return (
    <>
      {invite && inviteMessage[invite] ? (
        <p className="bg-muted text-muted-foreground rounded-lg border px-4 py-3 text-sm">
          {inviteMessage[invite]}
        </p>
      ) : null}
      <BudgetGrid view={view} />
    </>
  );
};

export default BudgetPage;
