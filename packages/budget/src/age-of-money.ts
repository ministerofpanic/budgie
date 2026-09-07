import { add, isNegative, negate, subtract, ZERO, type Pence } from "@budgie/core/money";
import type { AccountId, BudgetInput } from "./types";

const daysBetween = (earlierIso: string, laterIso: string): number => {
  const [ey, em, ed] = earlierIso.split("-").map(Number);
  const [ly, lm, ld] = laterIso.split("-").map(Number);
  const earlierMs = Date.UTC(ey!, em! - 1, ed!);
  const laterMs = Date.UTC(ly!, lm! - 1, ld!);
  return Math.round((laterMs - earlierMs) / 86_400_000);
};

type CashEvent = { readonly id: string; readonly date: string; readonly amountPence: Pence };

const creditAccountIds = (input: Pick<BudgetInput, "categories">): ReadonlySet<AccountId> =>
  new Set(
    input.categories
      .filter((category) => category.role?.kind === "payment")
      .map((category) => (category.role as { readonly accountId: AccountId }).accountId),
  );

const isOnBudget = (input: Pick<BudgetInput, "accounts">, accountId: AccountId): boolean =>
  input.accounts.find((account) => account.id === accountId)?.onBudget ?? false;

/**
 * The real cash movements Age of Money cares about - on-budget, non-credit
 * accounts only. A credit account purchase isn't a cash event yet (nothing
 * has left the on-budget pool); paying the card off is. A transfer between
 * two on-budget cash accounts nets to zero for the pool as a whole.
 */
const cashEvents = (
  input: Pick<BudgetInput, "accounts" | "transactions">,
  creditAccounts: ReadonlySet<AccountId>,
): CashEvent[] => {
  const events: CashEvent[] = [];

  const isCashOnBudget = (accountId: AccountId) =>
    isOnBudget(input, accountId) && !creditAccounts.has(accountId);

  for (const transaction of input.transactions) {
    if (transaction.kind === "category") {
      if (!isCashOnBudget(transaction.accountId)) continue;
      const net = transaction.entries.reduce((total, entry) => add(total, entry.amountPence), ZERO);
      if (net !== ZERO)
        events.push({ id: transaction.id, date: transaction.date, amountPence: net });
      continue;
    }

    const fromCash = isCashOnBudget(transaction.fromAccountId);
    const toCash = isCashOnBudget(transaction.toAccountId);
    if (fromCash && toCash) continue; // internal move, nets to zero
    if (fromCash)
      events.push({
        id: transaction.id,
        date: transaction.date,
        amountPence: negate(transaction.amountPence),
      });
    else if (toCash)
      events.push({
        id: transaction.id,
        date: transaction.date,
        amountPence: transaction.amountPence,
      });
  }

  return events.toSorted((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
};

/**
 * How many days old is the money consumed by the most recent spending
 * transaction - YNAB's Age of Money, computed the same way YNAB computes
 * it: a FIFO queue of inflows, oldest money spent first, re-evaluated after
 * every transaction rather than averaged over history. Returns null when
 * there's nothing to report yet (no outflow has ever drawn on a real
 * inflow).
 */
export const computeAgeOfMoney = (
  input: Pick<BudgetInput, "accounts" | "categories" | "transactions">,
): number | null => {
  const events = cashEvents(input, creditAccountIds(input));

  const queue: { date: string; remaining: Pence }[] = [];
  let result: number | null = null;

  for (const event of events) {
    if (!isNegative(event.amountPence)) {
      if (event.amountPence !== ZERO)
        queue.push({ date: event.date, remaining: event.amountPence });
      continue;
    }

    let toConsume = negate(event.amountPence);
    let ageForThisOutflow: number | null = null;
    while (toConsume > ZERO && queue.length > 0) {
      const batch = queue[0]!;
      if (ageForThisOutflow === null) ageForThisOutflow = daysBetween(batch.date, event.date);
      const consumed = toConsume < batch.remaining ? toConsume : batch.remaining;
      batch.remaining = subtract(batch.remaining, consumed);
      toConsume = subtract(toConsume, consumed);
      if (batch.remaining === ZERO) queue.shift();
    }

    if (ageForThisOutflow !== null) result = ageForThisOutflow;
  }

  return result;
};
