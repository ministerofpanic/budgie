"use server";

import { revalidatePath } from "next/cache";

import * as importDal from "@/lib/dal/import";
import * as reconcileDal from "@/lib/dal/reconcile";

export const previewImportAction = async (input: unknown) => importDal.previewImport(input);

export const commitImportAction = async (input: unknown, filename: string) => {
  const result = await importDal.commitImport(input, filename);
  revalidatePath("/budget");
  revalidatePath("/accounts/[id]", "page");
  revalidatePath("/accounts/[id]/import", "page");
  return result;
};

export const getImportMappingAction = async (accountId: string) =>
  importDal.getImportMapping(accountId);

export const listImportBatchesAction = async (accountId: string) =>
  importDal.listImportBatches(accountId);

export const undoImportBatchAction = async (batchId: string) => {
  await importDal.undoImportBatch(batchId);
  revalidatePath("/budget");
  revalidatePath("/accounts/[id]", "page");
  revalidatePath("/accounts/[id]/import", "page");
};

export const reconcileAccountAction = async (accountId: string, realBalanceInput: string) => {
  const result = await reconcileDal.reconcileAccount(accountId, realBalanceInput);
  if (result.ok) {
    revalidatePath("/budget");
    revalidatePath("/accounts/[id]", "page");
  }
  return result;
};
