import type { Pence } from "@budgie/core/money";
import type { MonthKey } from "./month";

export type AccountId = string;
export type CategoryId = string;

export type AccountInput = {
  readonly id: AccountId;
  /** Tracking accounts are off-budget: their transactions never touch a
   * category's available balance or Ready to Assign. */
  readonly onBudget: boolean;
};

/**
 * What a category is *for*, beyond being a normal spending bucket. Both roles
 * mark exactly one category each - the CLAUDE.md system category group for
 * "credit card payments" and "inflow" - and the engine trusts the caller not
 * to mark more than one category per account as that account's payment
 * category, or more than one category as the inflow category.
 */
export type CategoryRole =
  | { readonly kind: "normal" }
  | { readonly kind: "payment"; readonly accountId: AccountId }
  | { readonly kind: "inflow" };

export type CategoryInput = {
  readonly id: CategoryId;
  readonly role?: CategoryRole | undefined;
};

export type AssignmentInput = {
  readonly categoryId: CategoryId;
  readonly month: MonthKey;
  readonly assignedPence: Pence;
};

/** A regular (possibly split) transaction, categorised against one or more
 * categories. Never a transfer - see `TransferTransactionInput`. */
export type CategoryTransactionInput = {
  readonly kind: "category";
  readonly id: string;
  readonly accountId: AccountId;
  readonly date: string;
  readonly entries: readonly { readonly categoryId: CategoryId; readonly amountPence: Pence }[];
};

/** A transfer between two accounts. Never categorised: transfers between
 * on-budget accounts are neither income nor spending. The one exception the
 * engine knows about is a transfer that pays down a credit account - see the
 * module doc on `computeMonth`. */
export type TransferTransactionInput = {
  readonly kind: "transfer";
  readonly id: string;
  readonly date: string;
  readonly fromAccountId: AccountId;
  readonly toAccountId: AccountId;
  /** Always positive - the amount moved from `fromAccountId` to `toAccountId`. */
  readonly amountPence: Pence;
};

export type TransactionInput = CategoryTransactionInput | TransferTransactionInput;

export type BudgetInput = {
  readonly firstMonth: MonthKey;
  readonly accounts: readonly AccountInput[];
  readonly categories: readonly CategoryInput[];
  readonly assignments: readonly AssignmentInput[];
  readonly transactions: readonly TransactionInput[];
};

export type CategoryMonthResult = {
  readonly categoryId: CategoryId;
  readonly assigned: Pence;
  readonly activity: Pence;
  /** carried-in + assigned + activity. Negative on a normal category is
   * cash overspending; negative on a payment category is unfunded card debt -
   * the two behave differently at the following month's rollover. */
  readonly available: Pence;
};

export type MonthResult = {
  readonly month: MonthKey;
  readonly readyToAssign: Pence;
  readonly categories: readonly CategoryMonthResult[];
};
