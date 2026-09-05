import "server-only";

import { nextOccurrence, occurrencesDue, type Frequency } from "@budgie/budget";
import { parseAmount, type Pence } from "@budgie/core/money";
import { err, ok, type Result } from "@budgie/core/result";
import { db, schema } from "@budgie/db";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireBudget } from "@/lib/dal/budget";
import { getAccount, listAccounts } from "@/lib/dal/accounts";
import { requireOwnedCategory } from "@/lib/dal/categories";
import { recalculateRunningBalances } from "@/lib/dal/transactions";

export type ScheduledTransactionRow = {
  readonly id: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly payeeName: string | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly amountPence: number;
  readonly memo: string | null;
  readonly frequency: Frequency;
  readonly nextDate: string;
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const findOrCreatePayee = async (budgetId: string, name: string): Promise<string> => {
  const existing = await db.query.payee.findFirst({
    where: and(eq(schema.payee.budgetId, budgetId), eq(schema.payee.name, name)),
  });
  if (existing) return existing.id;
  const [created] = await db.insert(schema.payee).values({ budgetId, name }).returning();
  if (!created) throw new Error("Failed to create payee");
  return created.id;
};

export const listUpcoming = async (): Promise<readonly ScheduledTransactionRow[]> => {
  const { budgetId } = await requireBudget();
  const [accounts, rows] = await Promise.all([
    listAccounts(),
    db.query.scheduledTransaction.findMany({
      where: eq(schema.scheduledTransaction.budgetId, budgetId),
      orderBy: asc(schema.scheduledTransaction.nextDate),
    }),
  ]);
  if (rows.length === 0) return [];

  const accountName = new Map(accounts.map((account) => [account.id, account.name]));
  const [payees, categories] = await Promise.all([
    db.query.payee.findMany({ where: eq(schema.payee.budgetId, budgetId) }),
    db.query.category.findMany({ where: eq(schema.category.budgetId, budgetId) }),
  ]);
  const payeeName = new Map(payees.map((payee) => [payee.id, payee.name]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  return rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    accountName: accountName.get(row.accountId) ?? "Unknown account",
    payeeName: row.payeeId ? (payeeName.get(row.payeeId) ?? null) : null,
    categoryId: row.categoryId,
    categoryName: row.categoryId ? (categoryName.get(row.categoryId) ?? null) : null,
    amountPence: row.amountPence,
    memo: row.memo,
    frequency: row.frequency,
    nextDate: row.nextDate,
  }));
};

const inputSchema = z.object({
  accountId: z.uuid(),
  categoryId: z.uuid(),
  payeeName: z.string().trim().max(120).optional(),
  memo: z.string().trim().max(500).optional(),
  amountInput: z.string(),
  frequency: z.enum(["weekly", "fortnightly", "monthly", "yearly"]),
  nextDate: z.iso.date(),
});

export type ScheduledTransactionInputError =
  | { readonly kind: "invalid-amount" }
  | { readonly kind: "invalid-input" };

export const createScheduledTransaction = async (
  raw: unknown,
): Promise<Result<{ readonly id: string }, ScheduledTransactionInputError>> => {
  const { budgetId } = await requireBudget("editor");
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return err({ kind: "invalid-input" });
  const input = parsed.data;

  const account = await getAccount(input.accountId);
  if (!account) throw new Error(`No account ${input.accountId} in this budget`);
  await requireOwnedCategory(budgetId, input.categoryId);

  const amount = parseAmount(input.amountInput);
  if (!amount.ok) return err({ kind: "invalid-amount" });

  const payeeId = input.payeeName ? await findOrCreatePayee(budgetId, input.payeeName) : undefined;

  const [created] = await db
    .insert(schema.scheduledTransaction)
    .values({
      budgetId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      payeeId,
      amountPence: amount.value,
      memo: input.memo,
      frequency: input.frequency,
      nextDate: input.nextDate,
    })
    .returning();
  if (!created) throw new Error("Failed to create scheduled transaction");
  return ok({ id: created.id });
};

const requireOwnedSchedule = async (budgetId: string, id: string) => {
  const schedule = await db.query.scheduledTransaction.findFirst({
    where: and(
      eq(schema.scheduledTransaction.id, id),
      eq(schema.scheduledTransaction.budgetId, budgetId),
    ),
  });
  if (!schedule) throw new Error(`No scheduled transaction ${id} in this budget`);
  return schedule;
};

export const deleteScheduledTransaction = async (rawId: string): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  await requireOwnedSchedule(budgetId, id);
  await db.delete(schema.scheduledTransaction).where(eq(schema.scheduledTransaction.id, id));
};

/** Advances past the next occurrence without entering a transaction for it. */
export const skipNextOccurrence = async (rawId: string): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  const schedule = await requireOwnedSchedule(budgetId, id);
  const nextDate = nextOccurrence(schedule.nextDate, schedule.frequency);
  await db
    .update(schema.scheduledTransaction)
    .set({ nextDate, updatedAt: new Date() })
    .where(eq(schema.scheduledTransaction.id, id));
};

const insertEnteredTransaction = async (
  budgetId: string,
  schedule: typeof schema.scheduledTransaction.$inferSelect,
  date: string,
  amountPence: Pence,
): Promise<string> => {
  const [transaction] = await db
    .insert(schema.transaction)
    .values({
      budgetId,
      accountId: schedule.accountId,
      date,
      payeeId: schedule.payeeId,
      categoryId: schedule.categoryId,
      amountPence,
      memo: schedule.memo,
      scheduledTransactionOrigin: schedule.id,
    })
    .returning();
  if (!transaction) throw new Error("Failed to enter scheduled transaction");
  return transaction.id;
};

export type EnterOccurrenceOverrides = {
  readonly date?: string;
  readonly amountInput?: string;
};

/**
 * Enters the next due occurrence now - "edit this occurrence" is `overrides`,
 * which only affects the one transaction created; the stored schedule (and
 * every future occurrence) is untouched. Advances `nextDate` regardless.
 */
export const enterNextOccurrence = async (
  rawId: string,
  overrides?: EnterOccurrenceOverrides,
): Promise<Result<{ readonly id: string }, ScheduledTransactionInputError>> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  const schedule = await requireOwnedSchedule(budgetId, id);

  const amount = overrides?.amountInput
    ? parseAmount(overrides.amountInput)
    : ok(schedule.amountPence as Pence);
  if (!amount.ok) return err({ kind: "invalid-amount" });
  const date = overrides?.date ?? schedule.nextDate;

  const transactionId = await insertEnteredTransaction(budgetId, schedule, date, amount.value);
  await recalculateRunningBalances(schedule.accountId);

  const newNextDate = nextOccurrence(schedule.nextDate, schedule.frequency);
  await db
    .update(schema.scheduledTransaction)
    .set({ nextDate: newNextDate, lastEnteredDate: date, updatedAt: new Date() })
    .where(eq(schema.scheduledTransaction.id, id));

  return ok({ id: transactionId });
};

/**
 * Auto-entry: called on every visit to the scheduled-transactions page (this
 * app has no background job runner) to catch every schedule up to today,
 * entering one transaction per elapsed occurrence.
 */
export const autoEnterDue = async (): Promise<void> => {
  const { budgetId } = await requireBudget();
  const today = todayIso();
  const schedules = await db.query.scheduledTransaction.findMany({
    where: eq(schema.scheduledTransaction.budgetId, budgetId),
  });

  const touchedAccountIds = new Set<string>();

  await Promise.all(
    schedules.map(async (schedule) => {
      const due = occurrencesDue(schedule.nextDate, schedule.frequency, today);
      if (due.dueDates.length === 0) return;

      await Promise.all(
        due.dueDates.map((date) =>
          insertEnteredTransaction(budgetId, schedule, date, schedule.amountPence as Pence),
        ),
      );
      touchedAccountIds.add(schedule.accountId);
      await db
        .update(schema.scheduledTransaction)
        .set({
          nextDate: due.nextDate,
          lastEnteredDate: due.dueDates[due.dueDates.length - 1],
          updatedAt: new Date(),
        })
        .where(eq(schema.scheduledTransaction.id, schedule.id));
    }),
  );

  await Promise.all(
    [...touchedAccountIds].map((accountId) => recalculateRunningBalances(accountId)),
  );
};
