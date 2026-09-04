import "server-only";

import { db, schema } from "@budgie/db";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireBudget } from "@/lib/dal/budget";

export type CategoryRow = {
  readonly id: string;
  readonly groupId: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly hidden: boolean;
  readonly paymentForAccountId: string | null;
  readonly isInflow: boolean;
};

export type CategoryGroupRow = {
  readonly id: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly hidden: boolean;
  readonly isSystem: boolean;
  readonly categories: readonly CategoryRow[];
};

export const listCategoryGroups = async (): Promise<readonly CategoryGroupRow[]> => {
  const { budgetId } = await requireBudget();
  const [groups, categories] = await Promise.all([
    db.query.categoryGroup.findMany({
      where: eq(schema.categoryGroup.budgetId, budgetId),
      orderBy: asc(schema.categoryGroup.sortOrder),
    }),
    db.query.category.findMany({
      where: eq(schema.category.budgetId, budgetId),
      orderBy: asc(schema.category.sortOrder),
    }),
  ]);

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    sortOrder: group.sortOrder,
    hidden: group.hidden,
    isSystem: group.isSystem,
    categories: categories.filter((category) => category.groupId === group.id),
  }));
};

const nameSchema = z.string().trim().min(1, "Name is required.").max(80);

const requireOwnedGroup = async (budgetId: string, groupId: string) => {
  const group = await db.query.categoryGroup.findFirst({
    where: and(eq(schema.categoryGroup.id, groupId), eq(schema.categoryGroup.budgetId, budgetId)),
  });
  if (!group) throw new Error(`No category group ${groupId} in this budget`);
  return group;
};

export const requireOwnedCategory = async (budgetId: string, categoryId: string) => {
  const category = await db.query.category.findFirst({
    where: and(eq(schema.category.id, categoryId), eq(schema.category.budgetId, budgetId)),
  });
  if (!category) throw new Error(`No category ${categoryId} in this budget`);
  return category;
};

export const createCategoryGroup = async (rawName: string): Promise<CategoryGroupRow> => {
  const { budgetId } = await requireBudget("editor");
  const name = nameSchema.parse(rawName);

  const existing = await db.query.categoryGroup.findMany({
    where: eq(schema.categoryGroup.budgetId, budgetId),
  });
  const sortOrder = Math.max(0, ...existing.map((group) => group.sortOrder)) + 1;

  const [group] = await db
    .insert(schema.categoryGroup)
    .values({ budgetId, name, sortOrder })
    .returning();
  if (!group) throw new Error("Failed to create category group");
  return { ...group, categories: [] };
};

export const createCategory = async (rawGroupId: string, rawName: string): Promise<CategoryRow> => {
  const { budgetId } = await requireBudget("editor");
  const groupId = z.uuid().parse(rawGroupId);
  const name = nameSchema.parse(rawName);
  await requireOwnedGroup(budgetId, groupId);

  const existing = await db.query.category.findMany({
    where: eq(schema.category.groupId, groupId),
  });
  const sortOrder = Math.max(0, ...existing.map((category) => category.sortOrder)) + 1;

  const [category] = await db
    .insert(schema.category)
    .values({ budgetId, groupId, name, sortOrder })
    .returning();
  if (!category) throw new Error("Failed to create category");
  return category;
};

export const renameCategoryGroup = async (rawId: string, rawName: string): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  const name = nameSchema.parse(rawName);
  await requireOwnedGroup(budgetId, id);
  await db.update(schema.categoryGroup).set({ name }).where(eq(schema.categoryGroup.id, id));
};

export const renameCategory = async (rawId: string, rawName: string): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  const name = nameSchema.parse(rawName);
  await requireOwnedCategory(budgetId, id);
  await db.update(schema.category).set({ name }).where(eq(schema.category.id, id));
};

export const setCategoryHidden = async (rawId: string, hidden: boolean): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  await requireOwnedCategory(budgetId, id);
  await db.update(schema.category).set({ hidden }).where(eq(schema.category.id, id));
};

/**
 * Swaps sort order with the immediate neighbour - the simplest reorder
 * mechanic that still works on a phone with no drag-and-drop.
 */
export const moveCategory = async (rawId: string, direction: "up" | "down"): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  const category = await requireOwnedCategory(budgetId, id);

  const siblings = await db.query.category.findMany({
    where: eq(schema.category.groupId, category.groupId),
    orderBy: asc(schema.category.sortOrder),
  });
  const index = siblings.findIndex((sibling) => sibling.id === id);
  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  const neighbour = siblings[neighbourIndex];
  if (!neighbour) return;

  await db
    .update(schema.category)
    .set({ sortOrder: neighbour.sortOrder })
    .where(eq(schema.category.id, category.id));
  await db
    .update(schema.category)
    .set({ sortOrder: category.sortOrder })
    .where(eq(schema.category.id, neighbour.id));
};

/**
 * Deletes a category, reassigning its transactions, splits and assignments
 * to `reassignToId` first - a category is never just dropped out from under
 * money that's tracked against it.
 */
export const deleteCategory = async (rawId: string, rawReassignToId: string): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const id = z.uuid().parse(rawId);
  const reassignToId = z.uuid().parse(rawReassignToId);
  if (id === reassignToId) throw new Error("Cannot reassign a category to itself");

  const category = await requireOwnedCategory(budgetId, id);
  if (category.isInflow || category.paymentForAccountId) {
    throw new Error("Cannot delete a system category");
  }
  await requireOwnedCategory(budgetId, reassignToId);

  await db
    .update(schema.transaction)
    .set({ categoryId: reassignToId })
    .where(eq(schema.transaction.categoryId, id));
  await db
    .update(schema.transactionSplit)
    .set({ categoryId: reassignToId })
    .where(eq(schema.transactionSplit.categoryId, id));
  await db.delete(schema.categoryMonth).where(eq(schema.categoryMonth.categoryId, id));
  await db.delete(schema.category).where(eq(schema.category.id, id));
};
