import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  date,
  boolean,
  uniqueIndex,
  index,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { budget } from "./budget.ts";
import { account } from "./account.ts";
import { payee } from "./payee.ts";
import { category } from "./category.ts";
import { importBatch } from "./import-batch.ts";
import { scheduledTransaction } from "./scheduled-transaction.ts";

export const transaction = pgTable(
  "transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budget.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    payeeId: uuid("payee_id").references(() => payee.id, { onDelete: "set null" }),
    // Null when the transaction is split across categories - see transaction_split.
    categoryId: uuid("category_id").references(() => category.id, { onDelete: "set null" }),
    amountPence: integer("amount_pence").notNull(),
    // Rate from the account's currency to the budget's home currency, at
    // the time of the transaction. Null when they match (the common case)
    // - the engine and reports then use amountPence directly. Never
    // recomputed after the fact, so historical activity stays stable even
    // if today's spot rate moves.
    exchangeRate: numeric("exchange_rate", { precision: 18, scale: 8 }),
    memo: text("memo"),
    cleared: boolean("cleared").notNull().default(false),
    reconciled: boolean("reconciled").notNull().default(false),
    // Denormalized running balance, maintained by recalculateRunningBalances
    // in transactions.ts after any write touching amountPence/date/existence
    // for the account. Lets the register page with LIMIT/OFFSET instead of
    // folding full history per read.
    runningBalancePence: integer("running_balance_pence").notNull().default(0),
    transferPairId: uuid("transfer_pair_id"),
    importHash: text("import_hash"),
    importBatchId: uuid("import_batch_id").references(() => importBatch.id, {
      onDelete: "set null",
    }),
    scheduledTransactionOrigin: uuid("scheduled_transaction_origin").references(
      () => scheduledTransaction.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transaction_budget_date_idx").on(t.budgetId, t.date),
    index("transaction_account_date_id_idx").on(t.accountId, t.date, t.id),
    uniqueIndex("transaction_account_import_hash_idx")
      .on(t.accountId, t.importHash)
      .where(sql`${t.importHash} is not null`),
  ],
);
