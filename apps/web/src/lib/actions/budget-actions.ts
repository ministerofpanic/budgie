"use server";

import { revalidatePath } from "next/cache";

import * as categories from "@/lib/dal/categories";
import * as assignments from "@/lib/dal/assignments";
import * as transactions from "@/lib/dal/transactions";
import * as targets from "@/lib/dal/targets";
import * as accounts from "@/lib/dal/accounts";
import type { Result } from "@budgie/core/result";
import type { Pence } from "@budgie/core/money";
import { getExchangeRate, type ExchangeRateError } from "@budgie/core";
import { getOfflineSnapshot } from "@/lib/dal/offline";

export const fetchExchangeRateAction = async (
  from: string,
  to: string,
  date: string,
): Promise<Result<number, ExchangeRateError>> => getExchangeRate(from, to, date);

export const createAccountAction = async (name: string, type: unknown, currency?: string) => {
  const account = await accounts.createAccount(name, type, currency);
  revalidatePath("/", "layout");
  return account;
};

export const renameAccountAction = async (accountId: string, name: string) => {
  const account = await accounts.renameAccount(accountId, name);
  revalidatePath("/", "layout");
  return account;
};

export const closeAccountAction = async (accountId: string) => {
  await accounts.closeAccount(accountId);
  revalidatePath("/", "layout");
};

export const deleteAccountAction = async (accountId: string) => {
  await accounts.deleteAccount(accountId);
  revalidatePath("/", "layout");
};

export const assignCategoryAction = async (
  categoryId: string,
  month: string,
  amountInput: string,
  expectedUpdatedAt?: string,
): Promise<Result<Pence, assignments.AssignError>> => {
  const result = await assignments.setAssigned(categoryId, month, amountInput, expectedUpdatedAt);
  if (result.ok) revalidatePath("/budget");
  return result;
};

export const createCategoryGroupAction = async (name: string) => {
  const group = await categories.createCategoryGroup(name);
  revalidatePath("/budget");
  return group;
};

export const createCategoryAction = async (groupId: string, name: string) => {
  const category = await categories.createCategory(groupId, name);
  revalidatePath("/budget");
  return category;
};

export const renameCategoryGroupAction = async (id: string, name: string) => {
  await categories.renameCategoryGroup(id, name);
  revalidatePath("/budget");
};

export const renameCategoryAction = async (id: string, name: string) => {
  await categories.renameCategory(id, name);
  revalidatePath("/budget");
};

export const setCategoryHiddenAction = async (id: string, hidden: boolean) => {
  await categories.setCategoryHidden(id, hidden);
  revalidatePath("/budget");
};

export const moveCategoryAction = async (id: string, direction: "up" | "down") => {
  await categories.moveCategory(id, direction);
  revalidatePath("/budget");
};

export const deleteCategoryAction = async (id: string, reassignToId: string) => {
  await categories.deleteCategory(id, reassignToId);
  revalidatePath("/budget");
};

export const setTargetAction = async (categoryId: string, input: unknown) => {
  const result = await targets.setTarget(categoryId, input);
  if (result.ok) revalidatePath("/budget");
  return result;
};

export const deleteTargetAction = async (categoryId: string) => {
  await targets.deleteTarget(categoryId);
  revalidatePath("/budget");
};

export const createTransactionAction = async (input: unknown) => {
  const result = await transactions.createTransaction(input);
  if (result.ok) {
    revalidatePath("/budget");
    revalidatePath("/accounts/[id]", "page");
  }
  return result;
};

export const updateTransactionAction = async (id: string, input: unknown) => {
  const result = await transactions.updateTransaction(id, input);
  if (result.ok) {
    revalidatePath("/budget");
    revalidatePath("/accounts/[id]", "page");
  }
  return result;
};

export const setTransactionClearedAction = async (ids: readonly string[], cleared: boolean) => {
  await transactions.setTransactionCleared(ids, cleared);
  revalidatePath("/accounts/[id]", "page");
};

export const deleteTransactionsAction = async (ids: readonly string[]) => {
  await transactions.deleteTransactions(ids);
  revalidatePath("/budget");
  revalidatePath("/accounts/[id]", "page");
};

/** Used by the offline sync queue - single-row delete with the same
 * optimistic-concurrency guard `updateTransactionAction` gets via
 * `expectedUpdatedAt`. The bulk `deleteTransactionsAction` above is
 * unchanged and still backs the online multi-select UI. */
export const deleteTransactionWithConflictCheckAction = async (
  id: string,
  expectedUpdatedAt: string,
) => {
  const result = await transactions.deleteTransactionWithConflictCheck(id, expectedUpdatedAt);
  if (result.ok) {
    revalidatePath("/budget");
    revalidatePath("/accounts/[id]", "page");
  }
  return result;
};

export const getOfflineSnapshotAction = async () => getOfflineSnapshot();
