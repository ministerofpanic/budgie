"use server";

import { revalidatePath } from "next/cache";

import * as sharing from "@/lib/dal/sharing";
import { setActiveBudget } from "@/lib/dal/budget";

export const createInviteAction = async (role: unknown) => {
  const invite = await sharing.createInvite(role);
  revalidatePath("/sharing");
  return invite;
};

export const revokeInviteAction = async (id: string) => {
  await sharing.revokeInvite(id);
  revalidatePath("/sharing");
};

export const changeRoleAction = async (memberId: string, role: unknown) => {
  await sharing.changeRole(memberId, role);
  revalidatePath("/sharing");
};

export const removeMemberAction = async (memberId: string) => {
  await sharing.removeMember(memberId);
  revalidatePath("/sharing");
};

export const switchBudgetAction = async (budgetId: string) => {
  await setActiveBudget(budgetId);
  revalidatePath("/", "layout");
};
