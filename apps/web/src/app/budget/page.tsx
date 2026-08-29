import { compareMonths } from "@budgie/budget";

import { getBudgetMonth } from "@/lib/dal/budget-month";
import { requireBudget } from "@/lib/dal/budget";
import { listAccounts } from "@/lib/dal/accounts";
import { BudgetGrid } from "@/components/budget/budget-grid";

const currentMonthKey = (): string => {
  const now = new Date();
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

const BudgetPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly month?: string }>;
}) => {
  const { month: monthParam } = await searchParams;
  const { firstMonth } = await requireBudget();
  const requested = monthParam ?? currentMonthKey();
  const budgetFirstMonth = firstMonth.slice(0, 7);
  const month = compareMonths(requested, budgetFirstMonth) < 0 ? budgetFirstMonth : requested;

  const [view, accounts] = await Promise.all([getBudgetMonth(month), listAccounts()]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BudgetGrid view={view} accounts={accounts} />
    </main>
  );
};

export default BudgetPage;
