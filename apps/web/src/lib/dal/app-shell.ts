import "server-only";

import { listAccounts } from "@/lib/dal/accounts";
import { listMemberships, requireBudget } from "@/lib/dal/budget";

export type AppShellData = Awaited<ReturnType<typeof getAppShellData>>;

/** The three things every authenticated page needs to render `AppHeader` -
 * fetched together since every page needs all three anyway. */
export const getAppShellData = async () => {
  const [{ budgetId, currency }, accounts, memberships] = await Promise.all([
    requireBudget(),
    listAccounts(),
    listMemberships(),
  ]);
  return { accounts, memberships, activeBudgetId: budgetId, budgetCurrency: currency };
};
