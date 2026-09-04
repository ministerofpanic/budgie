/**
 * Target progress is a pure function of a target's rule and the category's
 * already-computed month result - it never touches the ledger itself, only
 * the `assigned` / `available` / `activity` figures `computeMonth` already
 * produced. That keeps "how much should I assign this month" and "did I hit
 * my spending cap" reconcilable against the same numbers the budget grid
 * shows.
 */
import { isPositive, subtract, unsafePence, ZERO, type Pence } from "@budgie/core/money";
import { monthOf, monthsBetween, type MonthKey } from "./month";
import type { CategoryMonthResult } from "./types";

export type Target =
  /** Assign exactly this much every month, regardless of what's already available. */
  | { readonly kind: "monthly"; readonly amountPence: Pence }
  /** Top available back up to this much every month - carried-over balance counts. */
  | { readonly kind: "refill"; readonly amountPence: Pence }
  /** Reach this much available by `dueDate`, spread evenly across the remaining months. */
  | { readonly kind: "by-date"; readonly amountPence: Pence; readonly dueDate: string }
  /** Don't spend more than this much in the month - never needs assignment. */
  | { readonly kind: "spending"; readonly amountPence: Pence };

export type TargetProgress = {
  /** How much should be assigned this month to stay on track. Zero for a spending cap. */
  readonly neededThisMonth: Pence;
  /** How far short of on-track this category is right now. For a spending cap, how far
   * over the cap this month's spending is. */
  readonly underfundedPence: Pence;
  readonly met: boolean;
};

const clampZero = (value: Pence): Pence => (value < ZERO ? ZERO : value);

export const computeTargetProgress = (
  target: Target,
  category: CategoryMonthResult,
  month: MonthKey,
): TargetProgress => {
  const availableBeforeAssign = subtract(category.available, category.assigned);

  switch (target.kind) {
    case "monthly": {
      const neededThisMonth = target.amountPence;
      const underfundedPence = clampZero(subtract(neededThisMonth, category.assigned));
      return { neededThisMonth, underfundedPence, met: underfundedPence === ZERO };
    }
    case "refill": {
      const neededThisMonth = clampZero(subtract(target.amountPence, availableBeforeAssign));
      const underfundedPence = clampZero(subtract(neededThisMonth, category.assigned));
      return { neededThisMonth, underfundedPence, met: underfundedPence === ZERO };
    }
    case "by-date": {
      const dueMonth = monthOf(target.dueDate);
      // A due date in the past is treated as due immediately - the whole
      // remaining amount is needed this month rather than dividing by zero
      // or a negative month count.
      const remainingMonths = Math.max(1, monthsBetween(month, dueMonth) + 1);
      const remainingTotal = clampZero(subtract(target.amountPence, availableBeforeAssign));
      const neededThisMonth = unsafePence(Math.ceil(remainingTotal / remainingMonths));
      const underfundedPence = clampZero(subtract(neededThisMonth, category.assigned));
      return { neededThisMonth, underfundedPence, met: underfundedPence === ZERO };
    }
    case "spending": {
      const spentThisMonth = isPositive(category.activity) ? ZERO : unsafePence(-category.activity);
      const overspentPence = clampZero(subtract(spentThisMonth, target.amountPence));
      return {
        neededThisMonth: ZERO,
        underfundedPence: overspentPence,
        met: overspentPence === ZERO,
      };
    }
  }
};
