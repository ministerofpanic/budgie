import "server-only";

import { parseAmount, type MoneyError, type Pence } from "@budgie/core/money";
import { ok, err, type Result } from "@budgie/core/result";
import { db, schema } from "@budgie/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireBudget } from "@/lib/dal/budget";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Not a valid month");

export type AssignError = MoneyError | { readonly kind: "category-not-found" };

/**
 * Sets the assigned amount for a category in a month (an upsert - there's at
 * most one row per category per month). The amount is user text like
 * "12.34" or "-5", parsed rather than trusted - a mistyped assign amount is
 * something the user caused, so it comes back as a `Result`, not a thrown
 * error the framework turns into a generic failure page.
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
