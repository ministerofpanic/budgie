import "server-only";

import { listAccounts } from "@/lib/dal/accounts";
import { listMemberships, requireBudget } from "@/lib/dal/budget";
import { requireSession } from "@/lib/session";

export type AppShellData = Awaited<ReturnType<typeof getAppShellData>>;

/** The things every authenticated page needs to render `AppHeader` -
 * fetched together since every page needs all of it anyway. `requireSession`
 * is `cache()`-deduped, so this doesn't cost an extra round trip beyond what
 * `requireBudget` already does internally. */
export const getAppShellData = async () => {
  const [{ budgetId, currency }, accounts, memberships, session] = await Promise.all([
    requireBudget(),
    listAccounts(),
    listMemberships(),
    requireSession(),
  ]);
  return {
    accounts,
    memberships,
    activeBudgetId: budgetId,
    budgetCurrency: currency,
    userName: session.user.name,
    userEmail: session.user.email,
  };
};
