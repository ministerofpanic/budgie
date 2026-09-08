import "server-only";

import { parseAmount, add, ZERO, type Pence } from "@budgie/core/money";
import { ok, err, type Result } from "@budgie/core/result";
import { db, schema } from "@budgie/db";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { requireBudget, expandFirstMonthIfEarlier } from "@/lib/dal/budget";
import { getAccount } from "@/lib/dal/accounts";
import { findOrCreatePayee } from "@/lib/dal/payees";
import { pageSizes, type PageSize } from "@/lib/pagination";

export { pageSizes, type PageSize };

export type TransactionSplitRow = {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amountPence: number;
};

export type TransactionRow = {
  readonly id: string;
  readonly date: string;
  readonly payeeName: string | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly memo: string | null;
  readonly amountPence: number;
  readonly exchangeRate: string | null;
  readonly cleared: boolean;
  readonly reconciled: boolean;
  readonly runningBalance: number;
  readonly splits: readonly TransactionSplitRow[];
};

export type ListTransactionsParams = {
  readonly accountId: string;
  readonly page: number;
  readonly pageSize: PageSize;
  readonly search?: string;
};

export type PaginatedTransactions = {
  readonly rows: readonly TransactionRow[];
  readonly totalCount: number;
};

/**
 * Recomputes and stores every transaction's running balance for an account
 * in a single indexed pass, using a window function rather than reading the
 * account into the app and folding it there. Call after any write that
 * changes amountPence, date, or row existence for the account - see the
 * call sites in this file (and import.ts, bank-connection.ts,
 * reconcile.ts, scheduled-transactions.ts) for the full list. Not needed
 * for writes that only touch cleared/reconciled/categoryId.
 */
export const recalculateRunningBalances = async (accountId: string): Promise<void> => {
  await db.execute(sql`
    UPDATE "transaction" t
    SET running_balance_pence = sub.balance
    FROM (
      SELECT id, SUM(amount_pence) OVER (ORDER BY date, id) AS balance
      FROM "transaction"
      WHERE account_id = ${accountId}
    ) sub
    WHERE t.id = sub.id
  `);
};

export const listForAccount = async (
  rawParams: ListTransactionsParams,
): Promise<PaginatedTransactions> => {
  const { budgetId } = await requireBudget();
  const accountId = z.uuid().parse(rawParams.accountId);
  const page = z.number().int().min(1).parse(rawParams.page);
  const pageSize = z
    .union([z.literal(25), z.literal(50), z.literal(100)])
    .parse(rawParams.pageSize);
  const search = rawParams.search?.trim();

  const account = await getAccount(accountId);
  if (!account) throw new Error(`No account ${accountId} in this budget`);

  let searchPredicate = undefined;
  if (search) {
    const like = `%${search}%`;
    const [matchedPayees, matchedCategories] = await Promise.all([
      db.query.payee.findMany({
        where: and(eq(schema.payee.budgetId, budgetId), ilike(schema.payee.name, like)),
        columns: { id: true },
      }),
      db.query.category.findMany({
        where: and(eq(schema.category.budgetId, budgetId), ilike(schema.category.name, like)),
        columns: { id: true },
      }),
    ]);
    const parsedAmount = parseAmount(search);

    const conditions = [
      ilike(schema.transaction.memo, like),
      matchedPayees.length > 0
        ? inArray(
            schema.transaction.payeeId,
            matchedPayees.map((payee) => payee.id),
          )
        : undefined,
      matchedCategories.length > 0
        ? inArray(
            schema.transaction.categoryId,
            matchedCategories.map((category) => category.id),
          )
        : undefined,
      parsedAmount.ok
        ? sql`abs(${schema.transaction.amountPence}) = abs(${parsedAmount.value})`
        : undefined,
    ].filter((condition) => condition !== undefined);
    searchPredicate = or(...conditions);
  }

  const where = and(eq(schema.transaction.accountId, accountId), searchPredicate);

  const [transactions, [{ totalCount } = { totalCount: 0 }]] = await Promise.all([
    db.query.transaction.findMany({
      where,
      orderBy: [desc(schema.transaction.date), desc(schema.transaction.id)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db.select({ totalCount: count() }).from(schema.transaction).where(where),
  ]);

  const [payees, categories, splits] = await Promise.all([
    db.query.payee.findMany({ where: eq(schema.payee.budgetId, budgetId) }),
    db.query.category.findMany({ where: eq(schema.category.budgetId, budgetId) }),
    transactions.length > 0
      ? db.query.transactionSplit.findMany({
          where: inArray(
            schema.transactionSplit.transactionId,
            transactions.map((transaction) => transaction.id),
          ),
        })
      : [],
  ]);
  const payeeName = new Map(payees.map((payee) => [payee.id, payee.name]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const splitsByTransaction = new Map<string, TransactionSplitRow[]>();
  for (const split of splits) {
    const rows = splitsByTransaction.get(split.transactionId) ?? [];
    rows.push({
      categoryId: split.categoryId,
      categoryName: categoryName.get(split.categoryId) ?? "Unknown category",
      amountPence: split.amountPence,
    });
    splitsByTransaction.set(split.transactionId, rows);
  }

  const rows: TransactionRow[] = transactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    payeeName: transaction.payeeId ? (payeeName.get(transaction.payeeId) ?? null) : null,
    categoryId: transaction.categoryId,
    categoryName: transaction.categoryId
      ? (categoryName.get(transaction.categoryId) ?? null)
      : null,
    memo: transaction.memo,
    amountPence: transaction.amountPence,
    exchangeRate: transaction.exchangeRate,
    cleared: transaction.cleared,
    reconciled: transaction.reconciled,
    runningBalance: transaction.runningBalancePence,
    splits: splitsByTransaction.get(transaction.id) ?? [],
  }));

  return { rows, totalCount };
};

const splitInputSchema = z.object({ categoryId: z.uuid(), amountInput: z.string() });

export const transactionInputSchema = z.object({
  accountId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payeeName: z.string().trim().max(120).optional(),
  memo: z.string().trim().max(500).optional(),
  cleared: z.boolean().default(false),
  outflowInput: z.string().optional(),
  inflowInput: z.string().optional(),
  categoryId: z.uuid().optional(),
  splits: z.array(splitInputSchema).optional(),
  /** Rate from the account's currency to the budget's home currency, when
   * they differ - pre-filled by the client from `getExchangeRate`, always
   * editable. Ignored (stored as null) when the account isn't foreign. */
  exchangeRateInput: z.string().optional(),
  /** Optimistic-concurrency guard: the `updatedAt` the caller last saw for
   * this row. Only checked when present - the offline sync queue always
   * supplies it (a stale edit made while offline must not silently
   * overwrite a newer server edit); a normal online single-device save
   * omits it and behaves as it always has. */
  expectedUpdatedAt: z.string().optional(),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export type TransactionInputError =
  | { readonly kind: "invalid-amount" }
  | { readonly kind: "amount-required" }
  | { readonly kind: "splits-dont-match-total" }
  | { readonly kind: "category-required" }
  | { readonly kind: "reconciled-locked" }
  | { readonly kind: "invalid-exchange-rate" }
  | { readonly kind: "conflict" };

/** Null when the account's currency matches the budget's - the common case,
 * where amountPence needs no conversion for the budget engine or reports. */
const resolveExchangeRate = (
  accountCurrency: string,
  budgetCurrency: string,
  exchangeRateInput: string | undefined,
): Result<number | null, TransactionInputError> => {
  if (accountCurrency === budgetCurrency) return ok(null);
  const rate = Number(exchangeRateInput);
  if (!exchangeRateInput || !Number.isFinite(rate) || rate <= 0) {
    return err({ kind: "invalid-exchange-rate" });
  }
  return ok(rate);
};

const resolveAmount = (
  input: Pick<TransactionInput, "outflowInput" | "inflowInput">,
): Result<Pence, TransactionInputError> => {
  const outflow = input.outflowInput?.trim();
  const inflow = input.inflowInput?.trim();
  if (!outflow && !inflow) return err({ kind: "amount-required" });
  if (outflow && inflow) return err({ kind: "invalid-amount" });

  const parsed = parseAmount(outflow ? `-${outflow}` : (inflow ?? ""));
  if (!parsed.ok) return err({ kind: "invalid-amount" });
  return ok(parsed.value);
};

const resolveSplits = (
  splits: readonly { readonly categoryId: string; readonly amountInput: string }[],
  total: Pence,
): Result<
  readonly { readonly categoryId: string; readonly amountPence: Pence }[],
  TransactionInputError
> => {
  const resolved: { readonly categoryId: string; readonly amountPence: Pence }[] = [];
  let sum: Pence = ZERO;
  for (const split of splits) {
    const parsed = parseAmount(split.amountInput);
    if (!parsed.ok) return err({ kind: "invalid-amount" });
    resolved.push({ categoryId: split.categoryId, amountPence: parsed.value });
    sum = add(sum, parsed.value);
  }
  if (sum !== total) return err({ kind: "splits-dont-match-total" });
  return ok(resolved);
};

export const createTransaction = async (
  raw: unknown,
): Promise<Result<{ readonly id: string }, TransactionInputError>> => {
  const { budgetId, currency: budgetCurrency } = await requireBudget("editor");
  const input = transactionInputSchema.parse(raw);
  const account = await getAccount(input.accountId);
  if (!account) throw new Error(`No account ${input.accountId} in this budget`);

  const amount = resolveAmount(input);
  if (!amount.ok) return amount;

  const exchangeRate = resolveExchangeRate(
    account.currency,
    budgetCurrency,
    input.exchangeRateInput,
  );
  if (!exchangeRate.ok) return exchangeRate;

  const splits =
    input.splits && input.splits.length > 0 ? resolveSplits(input.splits, amount.value) : undefined;
  if (splits && !splits.ok) return splits;
  if (!splits && !input.categoryId) return err({ kind: "category-required" });

  const payeeId = input.payeeName ? await findOrCreatePayee(budgetId, input.payeeName) : undefined;

  const [transaction] = await db
    .insert(schema.transaction)
    .values({
      budgetId,
      accountId: input.accountId,
      date: input.date,
      payeeId,
      categoryId: splits ? undefined : input.categoryId,
      amountPence: amount.value,
      exchangeRate: exchangeRate.value === null ? null : String(exchangeRate.value),
      memo: input.memo,
      cleared: input.cleared,
    })
    .returning();
  if (!transaction) throw new Error("Failed to create transaction");

  if (splits) {
    await db.insert(schema.transactionSplit).values(
      splits.value.map((split) => ({
        transactionId: transaction.id,
        categoryId: split.categoryId,
        amountPence: split.amountPence,
      })),
    );
  }

  await recalculateRunningBalances(input.accountId);
  await expandFirstMonthIfEarlier(budgetId, input.date);

  return ok({ id: transaction.id });
};

export const updateTransaction = async (
  rawId: string,
  raw: unknown,
): Promise<Result<{ readonly id: string }, TransactionInputError>> => {
  const { budgetId, currency: budgetCurrency } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  const existing = await db.query.transaction.findFirst({
    where: and(eq(schema.transaction.id, id), eq(schema.transaction.budgetId, budgetId)),
  });
  if (!existing) throw new Error(`No transaction ${id} in this budget`);
  if (existing.reconciled) return err({ kind: "reconciled-locked" });

  const input = transactionInputSchema.parse(raw);
  if (input.expectedUpdatedAt && existing.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    return err({ kind: "conflict" });
  }

  const account = await getAccount(input.accountId);
  if (!account) throw new Error(`No account ${input.accountId} in this budget`);

  const amount = resolveAmount(input);
  if (!amount.ok) return amount;

  const exchangeRate = resolveExchangeRate(
    account.currency,
    budgetCurrency,
    input.exchangeRateInput,
  );
  if (!exchangeRate.ok) return exchangeRate;

  const splits =
    input.splits && input.splits.length > 0 ? resolveSplits(input.splits, amount.value) : undefined;
  if (splits && !splits.ok) return splits;
  if (!splits && !input.categoryId) return err({ kind: "category-required" });

  const payeeId = input.payeeName ? await findOrCreatePayee(budgetId, input.payeeName) : undefined;

  // The WHERE clause re-checks updatedAt (not just the earlier read) to close
  // the race between reading `existing` and writing - a concurrent write
  // landing in between is still caught.
  const updateWhere = input.expectedUpdatedAt
    ? and(eq(schema.transaction.id, id), eq(schema.transaction.updatedAt, existing.updatedAt))
    : eq(schema.transaction.id, id);

  const updated = await db
    .update(schema.transaction)
    .set({
      accountId: input.accountId,
      date: input.date,
      payeeId,
      categoryId: splits ? null : (input.categoryId ?? null),
      amountPence: amount.value,
      exchangeRate: exchangeRate.value === null ? null : String(exchangeRate.value),
      memo: input.memo,
      cleared: input.cleared,
    })
    .where(updateWhere)
    .returning({ id: schema.transaction.id });

  if (input.expectedUpdatedAt && updated.length === 0) return err({ kind: "conflict" });

  await db.delete(schema.transactionSplit).where(eq(schema.transactionSplit.transactionId, id));
  if (splits) {
    await db.insert(schema.transactionSplit).values(
      splits.value.map((split) => ({
        transactionId: id,
        categoryId: split.categoryId,
        amountPence: split.amountPence,
      })),
    );
  }

  await recalculateRunningBalances(input.accountId);
  if (input.accountId !== existing.accountId) await recalculateRunningBalances(existing.accountId);
  await expandFirstMonthIfEarlier(budgetId, input.date);

  return ok({ id });
};

export const setTransactionCleared = async (
  rawIds: readonly string[],
  cleared: boolean,
): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const ids = z.array(z.uuid()).parse(rawIds);
  if (ids.length === 0) return;
  await db
    .update(schema.transaction)
    .set({ cleared })
    .where(
      and(
        inArray(schema.transaction.id, ids),
        eq(schema.transaction.budgetId, budgetId),
        eq(schema.transaction.reconciled, false),
      ),
    );
};

export const deleteTransactions = async (rawIds: readonly string[]): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const ids = z.array(z.uuid()).parse(rawIds);
  if (ids.length === 0) return;

  const toDelete = await db.query.transaction.findMany({
    where: and(
      inArray(schema.transaction.id, ids),
      eq(schema.transaction.budgetId, budgetId),
      eq(schema.transaction.reconciled, false),
    ),
    columns: { accountId: true },
  });
  const affectedAccountIds = [...new Set(toDelete.map((transaction) => transaction.accountId))];

  await db
    .delete(schema.transaction)
    .where(
      and(
        inArray(schema.transaction.id, ids),
        eq(schema.transaction.budgetId, budgetId),
        eq(schema.transaction.reconciled, false),
      ),
    );

  await Promise.all(affectedAccountIds.map((accountId) => recalculateRunningBalances(accountId)));
};

/**
 * Single-row delete with the same optimistic-concurrency guard as
 * `updateTransaction` - used by the offline sync queue, which always knows
 * the `updatedAt` it last saw. The bulk `deleteTransactions` above is
 * unchanged and still used by the online multi-select UI.
 */
export const deleteTransactionWithConflictCheck = async (
  rawId: string,
  expectedUpdatedAt: string,
): Promise<Result<{ readonly id: string }, TransactionInputError>> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);

  const existing = await db.query.transaction.findFirst({
    where: and(eq(schema.transaction.id, id), eq(schema.transaction.budgetId, budgetId)),
  });
  if (!existing) throw new Error(`No transaction ${id} in this budget`);
  if (existing.reconciled) return err({ kind: "reconciled-locked" });
  if (existing.updatedAt.toISOString() !== expectedUpdatedAt) return err({ kind: "conflict" });

  const deleted = await db
    .delete(schema.transaction)
    .where(and(eq(schema.transaction.id, id), eq(schema.transaction.updatedAt, existing.updatedAt)))
    .returning({ id: schema.transaction.id });
  if (deleted.length === 0) return err({ kind: "conflict" });

  await recalculateRunningBalances(existing.accountId);
  return ok({ id });
};
