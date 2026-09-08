import "server-only";

import { formatCsvRow } from "@budgie/core/csv";
import { toDecimalString, unsafePence, type Pence } from "@budgie/core/money";
import { db, schema } from "@budgie/db";
import { eq, inArray } from "drizzle-orm";

import { requireBudget } from "@/lib/dal/budget";

const clearedLabel = (transaction: {
  readonly cleared: boolean;
  readonly reconciled: boolean;
}): string =>
  transaction.reconciled ? "Reconciled" : transaction.cleared ? "Cleared" : "Uncleared";

const amountColumns = (
  amountPence: Pence,
): { readonly outflow: string; readonly inflow: string } =>
  amountPence < 0
    ? { outflow: toDecimalString(unsafePence(-amountPence)), inflow: "" }
    : { outflow: "", inflow: amountPence === 0 ? "" : toDecimalString(amountPence) };

const header = ["Account", "Date", "Payee", "Category", "Memo", "Outflow", "Inflow", "Cleared"];

/**
 * One CSV for the whole budget - every account's transactions, one row per
 * transaction or per split row for a split transaction. Amounts are the
 * account's native currency (whatever's stored in amountPence), since this
 * is a per-account ledger export, not a home-currency report.
 */
export const buildExportCsv = async (): Promise<string> => {
  const { budgetId } = await requireBudget();

  const [transactions, accounts, payees, categories, groups] = await Promise.all([
    db.query.transaction.findMany({ where: eq(schema.transaction.budgetId, budgetId) }),
    db.query.account.findMany({ where: eq(schema.account.budgetId, budgetId) }),
    db.query.payee.findMany({ where: eq(schema.payee.budgetId, budgetId) }),
    db.query.category.findMany({ where: eq(schema.category.budgetId, budgetId) }),
    db.query.categoryGroup.findMany({ where: eq(schema.categoryGroup.budgetId, budgetId) }),
  ]);

  const transactionIds = transactions.map((transaction) => transaction.id);
  const splits =
    transactionIds.length > 0
      ? await db.query.transactionSplit.findMany({
          where: inArray(schema.transactionSplit.transactionId, transactionIds),
        })
      : [];
  const splitsByTransaction = new Map<string, typeof splits>();
  for (const split of splits) {
    const existing = splitsByTransaction.get(split.transactionId) ?? [];
    existing.push(split);
    splitsByTransaction.set(split.transactionId, existing);
  }

  const accountName = new Map(accounts.map((account) => [account.id, account.name]));
  const payeeName = new Map(payees.map((payee) => [payee.id, payee.name]));
  const groupName = new Map(groups.map((group) => [group.id, group.name]));
  const categoryLabel = new Map(
    categories.map((category) => [
      category.id,
      `${groupName.get(category.groupId) ?? "Unknown group"}: ${category.name}`,
    ]),
  );

  const rows: string[][] = [];
  for (const transaction of transactions.toSorted(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )) {
    const account = accountName.get(transaction.accountId) ?? "Unknown account";
    const payee = transaction.payeeId ? (payeeName.get(transaction.payeeId) ?? "") : "";
    const memo = transaction.memo ?? "";
    const cleared = clearedLabel(transaction);

    if (transaction.categoryId) {
      const { outflow, inflow } = amountColumns(unsafePence(transaction.amountPence));
      rows.push([
        account,
        transaction.date,
        payee,
        categoryLabel.get(transaction.categoryId) ?? "",
        memo,
        outflow,
        inflow,
        cleared,
      ]);
      continue;
    }

    const transactionSplits = splitsByTransaction.get(transaction.id);
    if (transactionSplits && transactionSplits.length > 0) {
      for (const split of transactionSplits) {
        const { outflow, inflow } = amountColumns(unsafePence(split.amountPence));
        rows.push([
          account,
          transaction.date,
          payee,
          categoryLabel.get(split.categoryId) ?? "",
          split.memo ?? memo,
          outflow,
          inflow,
          cleared,
        ]);
      }
      continue;
    }

    const { outflow, inflow } = amountColumns(unsafePence(transaction.amountPence));
    rows.push([account, transaction.date, payee, "", memo, outflow, inflow, cleared]);
  }

  return [header, ...rows].map(formatCsvRow).join("\r\n") + "\r\n";
};
