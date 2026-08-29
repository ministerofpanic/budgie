import "server-only";

import { db, schema } from "@budgie/db";
import { and, asc, eq } from "drizzle-orm";

import { requireBudget } from "@/lib/dal/budget";

export type AccountRow = {
  readonly id: string;
  readonly name: string;
  readonly type: (typeof schema.accountType.enumValues)[number];
  readonly onBudget: boolean;
  readonly closed: boolean;
};

export const listAccounts = async (): Promise<readonly AccountRow[]> => {
  const { budgetId } = await requireBudget();
  return db.query.account.findMany({
    where: and(eq(schema.account.budgetId, budgetId), eq(schema.account.closed, false)),
    orderBy: asc(schema.account.sortOrder),
  });
};

export const getAccount = async (accountId: string): Promise<AccountRow | undefined> => {
  const { budgetId } = await requireBudget();
  return db.query.account.findFirst({
    where: and(eq(schema.account.id, accountId), eq(schema.account.budgetId, budgetId)),
  });
};
