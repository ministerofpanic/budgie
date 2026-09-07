import { ArrowDownRight, ArrowUpRight, Hourglass, Scale, TrendingUp } from "lucide-react";

import type { IncomeVsExpenditure, NetWorthPoint } from "@budgie/budget";
import { format, unsafePence } from "@budgie/core/money";
import type { SpendingByCategoryRow } from "@/lib/dal/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const money = (pence: number) => format(unsafePence(pence));

const NetWorthChart = ({ points }: { readonly points: readonly NetWorthPoint[] }) => {
  const values = points.map((point) => point.netWorthPence);
  const max = Math.max(1, ...values.map(Math.abs));

  return (
    <div className="flex h-40 gap-2">
      {points.map((point) => {
        const heightPercent = Math.max(2, (Math.abs(point.netWorthPence) / max) * 100);
        return (
          <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end">
              {/* Bar height is a runtime value - inline style is correct; server component, so react-perf's re-render concern doesn't apply. */}
              <div
                className={`w-full rounded-t ${point.netWorthPence < 0 ? "bg-money-negative" : "bg-money-positive"}`}
                style={{ height: `${String(heightPercent)}%` }}
              />
            </div>
            <span className="text-muted-foreground text-[10px]">{point.month.slice(2)}</span>
          </div>
        );
      })}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  displayValue,
  tone,
  icon: Icon,
}: {
  readonly label: string;
  readonly value?: number;
  readonly displayValue?: string;
  readonly tone: "positive" | "negative" | "neutral";
  readonly icon: typeof ArrowUpRight;
}) => {
  const toneClass =
    tone === "positive"
      ? "text-money-positive bg-money-positive/10"
      : tone === "negative"
        ? "text-money-negative bg-money-negative/10"
        : "text-foreground bg-muted";
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border p-4">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p className="tabular text-xl font-semibold">{displayValue ?? money(value ?? 0)}</p>
      </div>
    </div>
  );
};

const ReportsView = ({
  from,
  to,
  spending,
  incomeVsExpenditure,
  netWorth,
  ageOfMoney,
}: {
  readonly from: string;
  readonly to: string;
  readonly spending: readonly SpendingByCategoryRow[];
  readonly incomeVsExpenditure: IncomeVsExpenditure;
  readonly netWorth: readonly NetWorthPoint[];
  readonly ageOfMoney: number | null;
}) => {
  const totalSpent = spending.reduce((sum, row) => sum + row.spentPence, 0);
  const spendingRows = spending.filter((row) => row.spentPence > 0);
  const maxSpend = Math.max(1, ...spendingRows.map((row) => row.spentPence));

  return (
    <>
      <h1 className="text-xl font-semibold">Reports</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-from" className="text-xs">
            From
          </Label>
          <Input id="report-from" type="date" name="from" defaultValue={from} className="h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-to" className="text-xs">
            To
          </Label>
          <Input id="report-to" type="date" name="to" defaultValue={to} className="h-8" />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Update
        </Button>
      </form>

      <div className="flex flex-wrap gap-3">
        <StatCard
          label="Income"
          value={incomeVsExpenditure.incomePence}
          tone="positive"
          icon={ArrowUpRight}
        />
        <StatCard
          label="Expenditure"
          value={incomeVsExpenditure.expenditurePence}
          tone="negative"
          icon={ArrowDownRight}
        />
        <StatCard
          label="Net"
          value={incomeVsExpenditure.netPence}
          tone={incomeVsExpenditure.netPence < 0 ? "negative" : "positive"}
          icon={Scale}
        />
        <StatCard
          label="Age of Money"
          displayValue={ageOfMoney === null ? "Not enough data yet" : `${String(ageOfMoney)} days`}
          tone="neutral"
          icon={Hourglass}
        />
      </div>

      <section className="bg-card rounded-xl border p-4 shadow-sm">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Spending by category
        </p>
        <div className="mt-2 flex flex-col divide-y">
          {spendingRows.map((row) => (
            <div key={row.categoryId} className="flex flex-col gap-1 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm">{row.categoryName}</span>
                <span className="tabular text-sm font-medium">{money(row.spentPence)}</span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                {/* Bar width is a runtime value per row - see note above on NetWorthChart. */}
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${String((row.spentPence / maxSpend) * 100)}%` }}
                />
              </div>
            </div>
          ))}
          {spendingRows.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">No spending in this period.</p>
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
          <span>Total</span>
          <span className="tabular">{money(totalSpent)}</span>
        </div>
      </section>

      <section className="bg-card rounded-xl border p-4 shadow-sm">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
          <TrendingUp className="size-3.5" />
          Net worth over time
        </p>
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
