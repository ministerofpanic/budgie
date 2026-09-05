import "server-only";

import { parseAmount, subtract, sum, ZERO, type Pence } from "@budgie/core/money";
import { ok, err, type Result } from "@budgie/core/result";
import { db, schema } from "@budgie/db";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireBudget } from "@/lib/dal/budget";
import { getAccount } from "@/lib/dal/accounts";
import { recalculateRunningBalances } from "@/lib/dal/transactions";

export type ReconcileError = { readonly kind: "invalid-amount" };

export type ReconcileResult = {
  readonly clearedBalancePence: Pence;
  readonly adjustmentPence: Pence;
};

/**
 * Enters the real-world balance, creates an adjustment transaction for any
 * difference from what's cleared here, then locks every cleared transaction
 * (including the adjustment itself) by marking it reconciled - the DAL
 * refuses to edit or delete a reconciled row from then on.
 */
export const reconcileAccount = async (
  rawAccountId: string,
  realBalanceInput: string,
): Promise<Result<ReconcileResult, ReconcileError>> => {
  const { budgetId } = await requireBudget("editor");
  const accountId = z.uuid().parse(rawAccountId);
  const account = await getAccount(accountId);
  if (!account) throw new Error(`No account ${accountId} in this budget`);

  const realBalance = parseAmount(realBalanceInput);
  if (!realBalance.ok) return err({ kind: "invalid-amount" });

  const cleared = await db.query.transaction.findMany({
    where: and(
      eq(schema.transaction.accountId, accountId),
      eq(schema.transaction.cleared, true),
      eq(schema.transaction.reconciled, false),
    ),
  });
  const clearedBalancePence = sum(cleared.map((row) => row.amountPence as Pence));
  const adjustmentPence = subtract(realBalance.value, clearedBalancePence);

  const idsToLock = cleared.map((row) => row.id);

  if (adjustmentPence !== ZERO) {
    const [adjustment] = await db
      .insert(schema.transaction)
      .values({
        budgetId,
        accountId,
        date: new Date().toISOString().slice(0, 10),
        memo: "Reconciliation adjustment",
        amountPence: adjustmentPence,
        cleared: true,
      })
      .returning();
    if (!adjustment) throw new Error("Failed to create adjustment transaction");
    idsToLock.push(adjustment.id);
    await recalculateRunningBalances(accountId);
  }

  if (idsToLock.length > 0) {
    await db
      .update(schema.transaction)
      .set({ reconciled: true })
      .where(
        and(eq(schema.transaction.accountId, accountId), inArray(schema.transaction.id, idsToLock)),
      );
  }

  return ok({ clearedBalancePence, adjustmentPence });
};
