import { compareMonths, monthRange, type MonthKey } from "@budgie/budget";

import { requireBudget } from "@/lib/dal/budget";
import { getAppShellData } from "@/lib/dal/app-shell";
import {
  getIncomeVsExpenditure,
  getNetWorthByMonth,
  getSpendingByCategory,
} from "@/lib/dal/reports";
import { AppHeader } from "@/components/app-header";
import { ReportsView } from "@/components/reports/reports-view";

const currentMonthKey = (): MonthKey => {
  const now = new Date();
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

const firstOfMonth = (month: MonthKey): string => `${month}-01`;

const lastOfMonth = (month: MonthKey): string => {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
};

const ReportsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly from?: string; readonly to?: string }>;
}) => {
  const { from: fromParam, to: toParam } = await searchParams;
  const { firstMonth } = await requireBudget();
  const budgetFirstMonth = firstMonth.slice(0, 7);
  const currentMonth = currentMonthKey();

  const from = fromParam ?? firstOfMonth(currentMonth);
  const to = toParam ?? lastOfMonth(currentMonth);

  const netWorthMonths = monthRange(
    compareMonths(budgetFirstMonth, currentMonth) > 0 ? currentMonth : budgetFirstMonth,
    currentMonth,
  ).slice(-12);

  const [spending, incomeVsExpenditure, netWorth, shell] = await Promise.all([
    getSpendingByCategory(from, to),
    getIncomeVsExpenditure(from, to),
    getNetWorthByMonth(netWorthMonths),
    getAppShellData(),
  ]);

  return (
    <>
      <AppHeader {...shell} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
        <ReportsView
          from={from}
          to={to}
          spending={spending}
          incomeVsExpenditure={incomeVsExpenditure}
          netWorth={netWorth}
        />
      </main>
    </>
  );
};

export default ReportsPage;
