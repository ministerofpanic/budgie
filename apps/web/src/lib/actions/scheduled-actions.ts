"use server";

import { revalidatePath } from "next/cache";

import * as scheduled from "@/lib/dal/scheduled-transactions";

export const createScheduledTransactionAction = async (input: unknown) => {
  const result = await scheduled.createScheduledTransaction(input);
  if (result.ok) revalidatePath("/scheduled");
  return result;
};

export const deleteScheduledTransactionAction = async (id: string) => {
  await scheduled.deleteScheduledTransaction(id);
  revalidatePath("/scheduled");
};

export const skipNextOccurrenceAction = async (id: string) => {
  await scheduled.skipNextOccurrence(id);
  revalidatePath("/scheduled");
};

export const enterNextOccurrenceAction = async (
  id: string,
  overrides?: scheduled.EnterOccurrenceOverrides,
) => {
  const result = await scheduled.enterNextOccurrence(id, overrides);
  if (result.ok) {
    revalidatePath("/scheduled");
    revalidatePath("/budget");
    revalidatePath("/accounts/[id]", "page");
  }
  return result;
};
