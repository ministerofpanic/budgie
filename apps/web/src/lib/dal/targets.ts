import "server-only";

import type { Target } from "@budgie/budget";
import { pence, unsafePence, type MoneyError, type Pence } from "@budgie/core/money";
import { err, ok, type Result } from "@budgie/core/result";
import { db, schema } from "@budgie/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireBudget } from "@/lib/dal/budget";
import { requireOwnedCategory } from "@/lib/dal/categories";

export type TargetRow = {
  readonly categoryId: string;
  readonly target: Target;
};

const toTarget = (row: typeof schema.target.$inferSelect): Target | null => {
  switch (row.type) {
    case "monthly":
      return { kind: "monthly", amountPence: unsafePence(row.amountPence) };
    case "refill":
      return { kind: "refill", amountPence: unsafePence(row.amountPence) };
    case "spending":
      return { kind: "spending", amountPence: unsafePence(row.amountPence) };
    case "by-date":
      return row.dueDate
        ? { kind: "by-date", amountPence: unsafePence(row.amountPence), dueDate: row.dueDate }
        : null;
  }
};

/** All targets for a budget's categories, keyed by category. A row that fails to
 * translate (a "by-date" target with no due date, which the DB permits but the
 * engine can't act on) is dropped rather than surfaced as a category-wide error. */
export const listTargets = async (budgetId: string): Promise<ReadonlyMap<string, Target>> => {
  const categories = await db.query.category.findMany({
    where: eq(schema.category.budgetId, budgetId),
    columns: { id: true },
  });
  const categoryIds = new Set(categories.map((category) => category.id));
  if (categoryIds.size === 0) return new Map();

  const rows = await db.query.target.findMany();
  const byCategory = new Map<string, Target>();
  for (const row of rows) {
    if (!categoryIds.has(row.categoryId)) continue;
    const target = toTarget(row);
    if (target) byCategory.set(row.categoryId, target);
  }
  return byCategory;
};

const inputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("monthly"), amount: z.string() }),
  z.object({ kind: z.literal("refill"), amount: z.string() }),
  z.object({ kind: z.literal("spending"), amount: z.string() }),
  z.object({ kind: z.literal("by-date"), amount: z.string(), dueDate: z.iso.date() }),
]);

export type SetTargetInput = z.infer<typeof inputSchema>;
export type SetTargetError =
  | { readonly kind: "invalid-amount" }
  | { readonly kind: "invalid-input" };

const parseAmount = (raw: string): Result<Pence, MoneyError> => {
  const value = Math.round(Number(raw) * 100);
  return pence(value);
};

export const setTarget = async (
  rawCategoryId: string,
  rawInput: unknown,
): Promise<Result<Target, SetTargetError>> => {
  const { budgetId } = await requireBudget("editor");
  const categoryId = z.uuid().parse(rawCategoryId);
  await requireOwnedCategory(budgetId, categoryId);

  const parsedInput = inputSchema.safeParse(rawInput);
  if (!parsedInput.success) return err({ kind: "invalid-input" });
  const input = parsedInput.data;

  const amountResult = parseAmount(input.amount);
  if (!amountResult.ok) return err({ kind: "invalid-amount" });
  const amountPence = amountResult.value;

  const dueDate = input.kind === "by-date" ? input.dueDate : null;

  const existing = await db.query.target.findFirst({
    where: eq(schema.target.categoryId, categoryId),
  });

  if (existing) {
    await db
      .update(schema.target)
      .set({ type: input.kind, amountPence, dueDate, updatedAt: new Date() })
      .where(eq(schema.target.id, existing.id));
  } else {
    await db.insert(schema.target).values({ categoryId, type: input.kind, amountPence, dueDate });
  }

  return input.kind === "by-date"
    ? ok({ kind: "by-date", amountPence, dueDate: dueDate! })
    : ok({ kind: input.kind, amountPence });
};

export const deleteTarget = async (rawCategoryId: string): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const categoryId = z.uuid().parse(rawCategoryId);
  await requireOwnedCategory(budgetId, categoryId);
  await db.delete(schema.target).where(eq(schema.target.categoryId, categoryId));
};
