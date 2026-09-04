import Link from "next/link";

import type { IncomeVsExpenditure, NetWorthPoint } from "@budgie/budget";
import { format, unsafePence } from "@budgie/core/money";
import type { SpendingByCategoryRow } from "@/lib/dal/reports";

const money = (pence: number) => format(unsafePence(pence));

const NetWorthChart = ({ points }: { readonly points: readonly NetWorthPoint[] }) => {
  const values = points.map((point) => point.netWorthPence);
  const max = Math.max(1, ...values.map(Math.abs));

  return (
    <div className="flex items-end gap-2 h-40">
      {points.map((point) => {
        const heightPercent = Math.max(2, (Math.abs(point.netWorthPence) / max) * 100);
        return (
          <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-full w-full items-end">
              <div
                className={`w-full rounded-t ${point.netWorthPence < 0 ? "bg-money-negative" : "bg-money-positive"}`}
                style={{ height: `${String(heightPercent)}%` }}
              />
            </div>
            <span className="text-muted-foreground text-[10px]">{point.month}</span>
          </div>
        );
      })}
    </div>
  );
};

const ReportsView = ({
  from,
  to,
  spending,
  incomeVsExpenditure,
  netWorth,
}: {
  readonly from: string;
  readonly to: string;
  readonly spending: readonly SpendingByCategoryRow[];
  readonly incomeVsExpenditure: IncomeVsExpenditure;
  readonly netWorth: readonly NetWorthPoint[];
}) => {
  const totalSpent = spending.reduce((sum, row) => sum + row.spentPence, 0);

  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reports</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/budget" className="underline">
            &larr; Budget
          </Link>
          <Link href="/scheduled" className="underline">
            Scheduled
          </Link>
        </div>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          From
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          To
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
          />
        </label>
        <button type="submit" className="border-input h-8 rounded-md border px-3 text-sm">
          Update
        </button>
      </form>

      <section className="rounded-lg border p-4">
        <p className="text-muted-foreground text-xs uppercase">Income vs expenditure</p>
        <div className="mt-2 flex gap-6">
          <div>
            <p className="text-muted-foreground text-xs">Income</p>
            <p className="text-money-positive tabular text-xl font-semibold">
              {money(incomeVsExpenditure.incomePence)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Expenditure</p>
            <p className="text-money-negative tabular text-xl font-semibold">
              {money(incomeVsExpenditure.expenditurePence)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Net</p>
            <p
              className={`tabular text-xl font-semibold ${
                incomeVsExpenditure.netPence < 0 ? "text-money-negative" : "text-money-positive"
              }`}
            >
              {money(incomeVsExpenditure.netPence)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <p className="text-muted-foreground text-xs uppercase">Spending by category</p>
        <div className="mt-2 flex flex-col divide-y">
          {spending
            .filter((row) => row.spentPence > 0)
            .map((row) => (
              <div key={row.categoryId} className="flex items-center justify-between py-2">
                <span className="text-sm">{row.categoryName}</span>
                <span className="tabular text-sm font-medium">{money(row.spentPence)}</span>
              </div>
            ))}
          {spending.every((row) => row.spentPence === 0) ? (
            <p className="text-muted-foreground py-2 text-sm">No spending in this period.</p>
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
          <span>Total</span>
          <span className="tabular">{money(totalSpent)}</span>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <p className="text-muted-foreground text-xs uppercase">Net worth over time</p>
        <div className="mt-4">
          <NetWorthChart points={netWorth} />
        </div>
        <p className="text-muted-foreground mt-2 text-right text-sm">
          Latest: {money(netWorth[netWorth.length - 1]?.netWorthPence ?? 0)}
        </p>
      </section>
    </>
  );
};

export { ReportsView };
