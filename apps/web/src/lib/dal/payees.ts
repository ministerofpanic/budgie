import "server-only";

import { db, schema } from "@budgie/db";
import { and, desc, eq, isNotNull } from "drizzle-orm";

/** Safe to call concurrently for the same name: the unique (budget, name)
 * index means at most one insert wins, and the loser just re-selects. */
export const findOrCreatePayee = async (budgetId: string, name: string): Promise<string> => {
  const [inserted] = await db
    .insert(schema.payee)
    .values({ budgetId, name })
    .onConflictDoNothing({ target: [schema.payee.budgetId, schema.payee.name] })
    .returning();
  if (inserted) return inserted.id;

  const existing = await db.query.payee.findFirst({
    where: and(eq(schema.payee.budgetId, budgetId), eq(schema.payee.name, name)),
  });
  if (!existing) throw new Error(`Failed to find or create payee "${name}"`);
  return existing.id;
};

/**
 * The category a payee was most recently assigned to directly (not via a
 * split) - "payee memory", the same mechanism YNAB and Actual use for
 * auto-categorization: no ML, just remember what you picked last time.
 * Returns null for a payee with no categorized history yet.
 */
export const rememberedCategoryForPayee = async (payeeId: string): Promise<string | null> => {
  const last = await db.query.transaction.findFirst({
    where: and(eq(schema.transaction.payeeId, payeeId), isNotNull(schema.transaction.categoryId)),
    orderBy: [desc(schema.transaction.date), desc(schema.transaction.createdAt)],
    columns: { categoryId: true },
  });
  return last?.categoryId ?? null;
};
