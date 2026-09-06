import "server-only";

import { isNegative, parseAmount, type MoneyError, type Pence } from "@budgie/core/money";
import { ok, err, type Result } from "@budgie/core/result";
import { db, schema } from "@budgie/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireBudget } from "@/lib/dal/budget";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Not a valid month");

export type AssignError =
  | MoneyError
  | { readonly kind: "category-not-found" }
  | { readonly kind: "negative-not-allowed" };

/**
 * Sets the assigned amount for a category in a month (an upsert - there's at
 * most one row per category per month). The amount is user text like
 * "12.34", parsed rather than trusted - a mistyped assign amount is
 * something the user caused, so it comes back as a `Result`, not a thrown
 * error the framework turns into a generic failure page.
 *
 * A category can be reduced to zero but never assigned a negative amount:
 * the engine's cash-overspend handling (packages/budget/src/engine.ts) is
 * built for spending activity outrunning what's available, and wrongly
 * cancels a raw negative assignment against itself if one is ever stored -
 * matches real YNAB, which never lets "Assigned" itself go below zero.
 */
export const setAssigned = async (
  rawCategoryId: string,
  rawMonth: string,
  amountInput: string,
): Promise<Result<Pence, AssignError>> => {
  const { budgetId } = await requireBudget("editor");
  const categoryId = z.uuid().parse(rawCategoryId);
  const month = monthSchema.parse(rawMonth);

  const parsedAmount = parseAmount(amountInput);
  if (!parsedAmount.ok) return parsedAmount;
  if (isNegative(parsedAmount.value)) return err({ kind: "negative-not-allowed" });

  const category = await db.query.category.findFirst({
    where: and(eq(schema.category.id, categoryId), eq(schema.category.budgetId, budgetId)),
  });
  if (!category) return err({ kind: "category-not-found" });

  await db
    .insert(schema.categoryMonth)
    .values({ categoryId, month: `${month}-01`, assignedPence: parsedAmount.value })
    .onConflictDoUpdate({
      target: [schema.categoryMonth.categoryId, schema.categoryMonth.month],
      set: { assignedPence: parsedAmount.value },
    });

  return ok(parsedAmount.value);
};
