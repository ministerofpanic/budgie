import { pgTable, text, timestamp, uuid, integer, date, pgEnum } from "drizzle-orm/pg-core";
import { budget } from "./budget.ts";
import { account } from "./account.ts";
import { payee } from "./payee.ts";
import { category } from "./category.ts";

export const scheduledTransactionFrequency = pgEnum("scheduled_transaction_frequency", [
  "weekly",
  "fortnightly",
  "monthly",
  "yearly",
]);

export const scheduledTransaction = pgTable("scheduled_transaction", {
  id: uuid("id").primaryKey().defaultRandom(),
  budgetId: uuid("budget_id")
    .notNull()
    .references(() => budget.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  payeeId: uuid("payee_id").references(() => payee.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => category.id, { onDelete: "set null" }),
  amountPence: integer("amount_pence").notNull(),
  memo: text("memo"),
  frequency: scheduledTransactionFrequency("frequency").notNull(),
  nextDate: date("next_date").notNull(),
  lastEnteredDate: date("last_entered_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
