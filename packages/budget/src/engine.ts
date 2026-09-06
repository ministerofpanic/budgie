import { add, isNegative, negate, subtract, sum, ZERO, type Pence } from "@budgie/core/money";
import { compareMonths, monthOf, monthRange, type MonthKey } from "./month";
import type {
  AccountId,
  BudgetInput,
  CategoryId,
  CategoryMonthResult,
  CategoryTransactionInput,
  MonthResult,
  TransactionInput,
} from "./types";

type PaymentCategoryByAccount = ReadonlyMap<AccountId, CategoryId>;

const indexPaymentCategories = (input: BudgetInput): PaymentCategoryByAccount => {
  const map = new Map<AccountId, CategoryId>();
  for (const category of input.categories) {
    if (category.role?.kind === "payment") map.set(category.role.accountId, category.id);
  }
  return map;
};

const inflowCategoryId = (input: BudgetInput): CategoryId | undefined =>
  input.categories.find((category) => category.role?.kind === "inflow")?.id;

const paymentCategoryIds = (input: BudgetInput): ReadonlySet<CategoryId> =>
  new Set(
    input.categories
      .filter((category) => category.role?.kind === "payment")
      .map((category) => category.id),
  );

const isOnBudget = (input: BudgetInput, accountId: AccountId): boolean =>
  input.accounts.find((account) => account.id === accountId)?.onBudget ?? false;

const transactionsIn = (input: BudgetInput, month: MonthKey): readonly TransactionInput[] =>
  input.transactions.filter((transaction) => monthOf(transaction.date) === month);

/**
 * Every categorised entry in this month, in a stable order (date, then
 * transaction id) - the order credit-card movement is processed in, since
 * which transactions get "covered" by an available balance that runs out
 * partway through the month is order-dependent.
 */
const orderedCategoryTransactions = (
  transactions: readonly TransactionInput[],
): readonly CategoryTransactionInput[] =>
  transactions
    .filter(
      (transaction): transaction is CategoryTransactionInput => transaction.kind === "category",
    )
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

/**
 * Applies one month's activity - normal category activity, plus the
 * credit-card payment-category movement and payment-transfer rules - and
 * returns each category's activity total for the month.
 *
 * Credit card rule: spending on a credit account's category moves the same
 * amount into that account's payment category, but only up to what was
 * available in the spending category *before* this transaction - overspend
 * is never moved, so it shows up as ordinary (cash-style) overspend in the
 * spending category instead of inflating the payment category. Paying the
 * card down (a transfer into it) always reduces the payment category by the
 * full payment, even below zero: that's the one way a payment category goes
 * negative - a payment larger than what had been set aside for it.
 */
const computeActivity = (
  input: BudgetInput,
  month: MonthKey,
  availableBeforeActivity: ReadonlyMap<CategoryId, Pence>,
  paymentCategoryByAccount: PaymentCategoryByAccount,
): ReadonlyMap<CategoryId, Pence> => {
  const activity = new Map<CategoryId, Pence>();
  const addActivity = (categoryId: CategoryId, amount: Pence) => {
    activity.set(categoryId, add(activity.get(categoryId) ?? ZERO, amount));
  };

  // Seeded with carried-in balance *plus this month's assignment*: a
  // category's spending can be "covered" by money assigned this month, not
  // only by what rolled over from last month.
  const runningAvailable = new Map<CategoryId, Pence>(availableBeforeActivity);
  const transactions = transactionsIn(input, month);

  for (const transaction of orderedCategoryTransactions(transactions)) {
    if (!isOnBudget(input, transaction.accountId)) continue;
    const paymentCategoryId = paymentCategoryByAccount.get(transaction.accountId);

    for (const entry of transaction.entries) {
      addActivity(entry.categoryId, entry.amountPence);
      const availableBefore = runningAvailable.get(entry.categoryId) ?? ZERO;
      runningAvailable.set(entry.categoryId, add(availableBefore, entry.amountPence));

      const isSpend = isNegative(entry.amountPence);
      const onCreditAccount = paymentCategoryId !== undefined;
      const isPaymentCategoryItself = entry.categoryId === paymentCategoryId;
      if (!isSpend || !onCreditAccount || isPaymentCategoryItself) continue;

      const spendAmount = negate(entry.amountPence);
      const coverable = availableBefore > ZERO ? availableBefore : ZERO;
      const moved = spendAmount < coverable ? spendAmount : coverable;
      if (moved === ZERO) continue;

      // The move comes out of the spending category's *running* available so
      // a later transaction in the same month sees what's left, but it must
      // not also reduce that category's reported activity - the outflow
      // above already did that. It only affects the payment category.
      addActivity(paymentCategoryId, moved);
    }
  }

  for (const transaction of transactions) {
    if (transaction.kind !== "transfer") continue;
    const toPaymentCategory = paymentCategoryByAccount.get(transaction.toAccountId);
    if (toPaymentCategory === undefined) continue;
    addActivity(toPaymentCategory, negate(transaction.amountPence));
  }

  return activity;
};

/**
 * Computes Ready to Assign and every category's assigned / activity /
 * available for `month`, folding forward from `input.firstMonth` since
 * nothing is ever stored between months - only assignments and transactions.
 *
 * Ready to Assign = inflows to on-budget accounts up to and including this
 * month, minus everything assigned up to and including this month, minus
 * this month's own cash overspending (categories reset to zero rather than
 * carry a negative balance forward - the shortfall is deducted from Ready
 * to Assign immediately, the same month it happens, matching YNAB). A
 * payment category's negative balance is the opposite: it carries forward
 * as-is, since it represents real unfunded card debt rather than a one-off
 * overspend to be absorbed.
 */
export const computeMonth = (input: BudgetInput, month: MonthKey): MonthResult => {
  if (compareMonths(month, input.firstMonth) < 0) {
    throw new RangeError(`"${month}" is before the budget's first month "${input.firstMonth}"`);
  }

  const paymentCategoryByAccount = indexPaymentCategories(input);
  const paymentCategories = paymentCategoryIds(input);
  const inflowCategory = inflowCategoryId(input);

  let carriedIn = new Map<CategoryId, Pence>(
    input.categories.map((category) => [category.id, ZERO]),
  );
  let readyToAssign = ZERO;

  let result: MonthResult | undefined;

  for (const currentMonth of monthRange(input.firstMonth, month)) {
    const assignedByCategory = new Map<CategoryId, Pence>();
    for (const assignment of input.assignments) {
      if (assignment.month !== currentMonth) continue;
      assignedByCategory.set(
        assignment.categoryId,
        add(assignedByCategory.get(assignment.categoryId) ?? ZERO, assignment.assignedPence),
      );
    }
    const totalAssigned = sum([...assignedByCategory.values()]);

    const availableBeforeActivity = new Map<CategoryId, Pence>(
      input.categories.map((category) => [
        category.id,
        add(carriedIn.get(category.id) ?? ZERO, assignedByCategory.get(category.id) ?? ZERO),
      ]),
    );
    const activity = computeActivity(
      input,
      currentMonth,
      availableBeforeActivity,
      paymentCategoryByAccount,
    );

    const inflow = inflowCategory === undefined ? ZERO : (activity.get(inflowCategory) ?? ZERO);

    const nextCarriedIn = new Map<CategoryId, Pence>();
    let cashOverspend = ZERO;
    const categories: CategoryMonthResult[] = [];

    for (const category of input.categories) {
      const assigned = assignedByCategory.get(category.id) ?? ZERO;
      const categoryActivity = activity.get(category.id) ?? ZERO;
      const available = add(add(carriedIn.get(category.id) ?? ZERO, assigned), categoryActivity);

      if (!isNegative(available) || paymentCategories.has(category.id)) {
        nextCarriedIn.set(category.id, available);
      } else {
        nextCarriedIn.set(category.id, ZERO);
        cashOverspend = add(cashOverspend, negate(available));
      }

      categories.push({ categoryId: category.id, assigned, activity: categoryActivity, available });
    }

    readyToAssign = subtract(add(readyToAssign, inflow), add(totalAssigned, cashOverspend));

    carriedIn = nextCarriedIn;
    result = { month: currentMonth, readyToAssign, categories };
  }

  if (!result) throw new Error("unreachable: monthRange always includes at least one month");
  return result;
};
