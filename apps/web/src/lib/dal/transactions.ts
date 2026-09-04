import "server-only";

import { parseAmount, add, ZERO, type Pence } from "@budgie/core/money";
import { ok, err, type Result } from "@budgie/core/result";
import { db, schema } from "@budgie/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireBudget } from "@/lib/dal/budget";
import { getAccount } from "@/lib/dal/accounts";

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
  readonly cleared: boolean;
  readonly reconciled: boolean;
  readonly runningBalance: number;
  readonly splits: readonly TransactionSplitRow[];
};

export const listForAccount = async (rawAccountId: string): Promise<readonly TransactionRow[]> => {
  const { budgetId } = await requireBudget();
  const accountId = z.uuid().parse(rawAccountId);
  const account = await getAccount(accountId);
  if (!account) throw new Error(`No account ${accountId} in this budget`);

  const transactions = await db.query.transaction.findMany({
    where: eq(schema.transaction.accountId, accountId),
    orderBy: [asc(schema.transaction.date), asc(schema.transaction.id)],
  });

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

  let runningBalance: Pence = ZERO;
  const rows: TransactionRow[] = [];
  for (const transaction of transactions) {
    runningBalance = add(runningBalance, transaction.amountPence as Pence);
    rows.push({
      id: transaction.id,
      date: transaction.date,
      payeeName: transaction.payeeId ? (payeeName.get(transaction.payeeId) ?? null) : null,
      categoryId: transaction.categoryId,
      categoryName: transaction.categoryId
        ? (categoryName.get(transaction.categoryId) ?? null)
        : null,
      memo: transaction.memo,
      amountPence: transaction.amountPence,
      cleared: transaction.cleared,
      reconciled: transaction.reconciled,
      runningBalance,
      splits: splitsByTransaction.get(transaction.id) ?? [],
    });
  }

  return rows.toReversed();
};

const findOrCreatePayee = async (budgetId: string, name: string): Promise<string> => {
  const existing = await db.query.payee.findFirst({
    where: and(eq(schema.payee.budgetId, budgetId), eq(schema.payee.name, name)),
  });
  if (existing) return existing.id;

  const [created] = await db.insert(schema.payee).values({ budgetId, name }).returning();
  if (!created) throw new Error("Failed to create payee");
  return created.id;
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
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export type TransactionInputError =
  | { readonly kind: "invalid-amount" }
  | { readonly kind: "amount-required" }
  | { readonly kind: "splits-dont-match-total" }
  | { readonly kind: "category-required" }
  | { readonly kind: "reconciled-locked" };

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
  const { budgetId } = await requireBudget("editor");
  const input = transactionInputSchema.parse(raw);
  const account = await getAccount(input.accountId);
  if (!account) throw new Error(`No account ${input.accountId} in this budget`);

  const amount = resolveAmount(input);
  if (!amount.ok) return amount;

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

  return ok({ id: transaction.id });
};

export const updateTransaction = async (
  rawId: string,
  raw: unknown,
): Promise<Result<{ readonly id: string }, TransactionInputError>> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  const existing = await db.query.transaction.findFirst({
    where: and(eq(schema.transaction.id, id), eq(schema.transaction.budgetId, budgetId)),
  });
  if (!existing) throw new Error(`No transaction ${id} in this budget`);
  if (existing.reconciled) return err({ kind: "reconciled-locked" });

  const input = transactionInputSchema.parse(raw);
  const account = await getAccount(input.accountId);
  if (!account) throw new Error(`No account ${input.accountId} in this budget`);

  const amount = resolveAmount(input);
  if (!amount.ok) return amount;

  const splits =
    input.splits && input.splits.length > 0 ? resolveSplits(input.splits, amount.value) : undefined;
  if (splits && !splits.ok) return splits;
  if (!splits && !input.categoryId) return err({ kind: "category-required" });

  const payeeId = input.payeeName ? await findOrCreatePayee(budgetId, input.payeeName) : undefined;

  await db
    .update(schema.transaction)
    .set({
      accountId: input.accountId,
      date: input.date,
      payeeId,
      categoryId: splits ? null : (input.categoryId ?? null),
      amountPence: amount.value,
      memo: input.memo,
      cleared: input.cleared,
    })
    .where(eq(schema.transaction.id, id));

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
  await db
    .delete(schema.transaction)
    .where(
      and(
        inArray(schema.transaction.id, ids),
        eq(schema.transaction.budgetId, budgetId),
        eq(schema.transaction.reconciled, false),
      ),
    );
};
