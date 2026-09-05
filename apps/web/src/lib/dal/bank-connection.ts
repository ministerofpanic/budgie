import "server-only";

import { db, schema } from "@budgie/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import {
  createRequisition,
  getAccessToken,
  getAccountTransactions,
  getRequisition,
  listInstitutions as gcListInstitutions,
  type GoCardlessCredentials,
} from "@budgie/core/gocardless";
import { computeImportFingerprint } from "@budgie/core/csv";

import { requireBudget } from "@/lib/dal/budget";
import { getAccount } from "@/lib/dal/accounts";

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set - copy .env.example to .env and fill it in.`);
  return value;
};

const credentials = (): GoCardlessCredentials => ({
  secretId: env("GOCARDLESS_SECRET_ID"),
  secretKey: env("GOCARDLESS_SECRET_KEY"),
});

export type InstitutionOption = {
  readonly id: string;
  readonly name: string;
  readonly logo: string;
};

export const listInstitutions = async (): Promise<readonly InstitutionOption[]> => {
  await requireBudget();
  const token = await getAccessToken(credentials());
  if (!token.ok) throw new Error(`Failed to authenticate with GoCardless: ${token.error.kind}`);

  const institutions = await gcListInstitutions(token.value);
  if (!institutions.ok) throw new Error(`Failed to list institutions: ${institutions.error.kind}`);
  return institutions.value;
};

export type BankConnectionRow = {
  readonly institutionName: string;
  readonly status: (typeof schema.bankConnectionStatus.enumValues)[number];
  readonly lastSyncedAt: string | null;
  readonly transactionsRemainingToday: number | null;
  readonly transactionsResetAt: string | null;
};

export const getBankConnection = async (
  rawAccountId: string,
): Promise<BankConnectionRow | undefined> => {
  const { budgetId } = await requireBudget();
  const accountId = z.uuid().parse(rawAccountId);
  const account = await db.query.account.findFirst({
    where: and(eq(schema.account.id, accountId), eq(schema.account.budgetId, budgetId)),
  });
  if (!account) return undefined;

  const connection = await db.query.bankConnection.findFirst({
    where: eq(schema.bankConnection.accountId, accountId),
  });
  if (!connection) return undefined;

  return {
    institutionName: connection.institutionName,
    status: connection.status,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    transactionsRemainingToday: connection.transactionsRemainingToday,
    transactionsResetAt: connection.transactionsResetAt?.toISOString() ?? null,
  };
};

/** Starts a bank link: creates a GoCardless agreement + requisition and
 * returns the bank-hosted consent URL to redirect the browser to. Budgie's
 * own UI never sees bank credentials - the user authenticates on the bank's
 * own domain and is bounced back to `/api/gocardless/callback`. */
export const startBankLink = async (
  rawAccountId: string,
  rawInstitutionId: string,
  rawInstitutionName: string,
): Promise<{ readonly link: string }> => {
  await requireBudget("editor");
  const accountId = z.uuid().parse(rawAccountId);
  const institutionId = z.string().min(1).parse(rawInstitutionId);
  const institutionName = z.string().min(1).parse(rawInstitutionName);

  const account = await getAccount(accountId);
  if (!account) throw new Error(`No account ${accountId} in this budget`);

  const token = await getAccessToken(credentials());
  if (!token.ok) throw new Error(`Failed to authenticate with GoCardless: ${token.error.kind}`);

  const redirectUrl = `${env("NEXT_PUBLIC_APP_URL")}/api/gocardless/callback?accountId=${accountId}`;
  const requisition = await createRequisition(token.value, {
    institutionId,
    redirectUrl,
    reference: accountId,
  });
  if (!requisition.ok) {
    throw new Error(`Failed to create GoCardless requisition: ${requisition.error.kind}`);
  }

  await db
    .insert(schema.bankConnection)
    .values({
      accountId,
      institutionId,
      institutionName,
      requisitionId: requisition.value.requisitionId,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: schema.bankConnection.accountId,
      set: {
        institutionId,
        institutionName,
        requisitionId: requisition.value.requisitionId,
        status: "pending",
        gocardlessAccountId: null,
        updatedAt: new Date(),
      },
    });

  return { link: requisition.value.link };
};

/** Called from the GoCardless redirect callback once the user has finished
 * authenticating at their bank. Polls the requisition for the linked
 * account UUID and marks the connection as linked. */
export const completeBankLink = async (rawAccountId: string): Promise<void> => {
  await requireBudget("editor");
  const accountId = z.uuid().parse(rawAccountId);

  const connection = await db.query.bankConnection.findFirst({
    where: eq(schema.bankConnection.accountId, accountId),
  });
  if (!connection) throw new Error(`No pending bank connection for account ${accountId}`);

  const token = await getAccessToken(credentials());
  if (!token.ok) throw new Error(`Failed to authenticate with GoCardless: ${token.error.kind}`);

  const status = await getRequisition(token.value, connection.requisitionId);
  if (!status.ok) throw new Error(`Failed to read requisition status: ${status.error.kind}`);

  const gocardlessAccountId = status.value.accountIds[0];
  if (status.value.status !== "LN" || !gocardlessAccountId) {
    await db
      .update(schema.bankConnection)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(schema.bankConnection.accountId, accountId));
    return;
  }

  await db
    .update(schema.bankConnection)
    .set({
      gocardlessAccountId,
      status: "linked",
      agreementExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    })
    .where(eq(schema.bankConnection.accountId, accountId));
};

/** Safe to call concurrently for the same name: the unique (budget, name)
 * index means at most one insert wins, and the loser just re-selects. */
const findOrCreatePayee = async (budgetId: string, name: string): Promise<string> => {
  const [inserted] = await db
    .insert(schema.payee)
    .values({ budgetId, name })
    .onConflictDoNothing({ target: [schema.payee.budgetId, schema.payee.name] })
    .returning();
  if (inserted) return inserted.id;

  const existing = await db.query.payee.findFirst({
    where: and(eq(schema.payee.budgetId, budgetId), eq(schema.payee.name, name)),
  });
  if (!existing) throw new Error(`Failed to find or create payee "${name}"`);
  return existing.id;
};

export const syncBankTransactions = async (
  rawAccountId: string,
): Promise<{ readonly created: number; readonly skipped: number }> => {
  const { budgetId } = await requireBudget("editor");
  const accountId = z.uuid().parse(rawAccountId);

  const connection = await db.query.bankConnection.findFirst({
    where: eq(schema.bankConnection.accountId, accountId),
  });
  if (!connection || connection.status !== "linked" || !connection.gocardlessAccountId) {
    throw new Error(`Account ${accountId} has no linked bank connection`);
  }
  if (
    connection.transactionsRemainingToday !== null &&
    connection.transactionsRemainingToday <= 0 &&
    connection.transactionsResetAt &&
    connection.transactionsResetAt.getTime() > Date.now()
  ) {
    throw new Error("Daily GoCardless sync limit reached for this account - try again later.");
  }

  const token = await getAccessToken(credentials());
  if (!token.ok) throw new Error(`Failed to authenticate with GoCardless: ${token.error.kind}`);

  const result = await getAccountTransactions(token.value, connection.gocardlessAccountId);
  if (!result.ok) {
    if (result.error.kind === "http" && result.error.status === 429) {
      await db
        .update(schema.bankConnection)
        .set({ transactionsRemainingToday: 0, updatedAt: new Date() })
        .where(eq(schema.bankConnection.accountId, accountId));
    }
    throw new Error(`Failed to fetch transactions: ${result.error.kind}`);
  }

  await db
    .update(schema.bankConnection)
    .set({
      lastSyncedAt: new Date(),
      transactionsRemainingToday: result.value.rateLimit.remaining,
      transactionsResetAt: result.value.rateLimit.resetAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.bankConnection.accountId, accountId));

  const existingHashes = new Set(
    (
      await db.query.transaction.findMany({
        where: and(
          eq(schema.transaction.accountId, accountId),
          isNotNull(schema.transaction.importHash),
        ),
        columns: { importHash: true },
      })
    ).map((row) => row.importHash),
  );

  const toCreate = result.value.transactions.filter(
    (tx) =>
      !existingHashes.has(
        computeImportFingerprint(accountId, tx.date, tx.amountPence, tx.payeeName),
      ),
  );
  if (toCreate.length === 0) return { created: 0, skipped: result.value.transactions.length };

  const [batch] = await db
    .insert(schema.importBatch)
    .values({
      budgetId,
      accountId,
      filename: `${connection.institutionName} sync`,
      rowCount: toCreate.length,
    })
    .returning();
  if (!batch) throw new Error("Failed to create import batch");

  const distinctPayeeNames = [
    ...new Set(toCreate.map((tx) => tx.payeeName).filter((name) => name !== null)),
  ];
  const payeeIdByName = new Map(
    await Promise.all(
      distinctPayeeNames.map(
        async (name) => [name, await findOrCreatePayee(budgetId, name)] as const,
      ),
    ),
  );

  const insertedRows = await Promise.all(
    toCreate.map((tx) =>
      db
        .insert(schema.transaction)
        .values({
          budgetId,
          accountId,
          date: tx.date,
          payeeId: tx.payeeName ? payeeIdByName.get(tx.payeeName) : undefined,
          memo: tx.memo,
          amountPence: tx.amountPence,
          importHash: computeImportFingerprint(accountId, tx.date, tx.amountPence, tx.payeeName),
          importBatchId: batch.id,
        })
        .onConflictDoNothing({
          target: [schema.transaction.accountId, schema.transaction.importHash],
          where: isNotNull(schema.transaction.importHash),
        })
        .returning({ id: schema.transaction.id }),
    ),
  );
  const created = insertedRows.filter((rows) => rows.length > 0).length;

  await db
    .update(schema.importBatch)
    .set({ rowCount: created })
    .where(eq(schema.importBatch.id, batch.id));

  return { created, skipped: result.value.transactions.length - created };
};
