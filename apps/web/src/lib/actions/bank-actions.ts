"use server";

import { revalidatePath } from "next/cache";

import * as bankConnectionDal from "@/lib/dal/bank-connection";

export const listInstitutionsAction = async () => bankConnectionDal.listInstitutions();

export const getBankConnectionAction = async (accountId: string) =>
  bankConnectionDal.getBankConnection(accountId);

export const startBankLinkAction = async (
  accountId: string,
  institutionId: string,
  institutionName: string,
) => bankConnectionDal.startBankLink(accountId, institutionId, institutionName);

export const syncBankTransactionsAction = async (accountId: string) => {
  const result = await bankConnectionDal.syncBankTransactions(accountId);
  revalidatePath("/budget");
  revalidatePath("/accounts/[id]", "page");
  return result;
};
