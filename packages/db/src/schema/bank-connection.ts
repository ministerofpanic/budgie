import { pgTable, text, timestamp, uuid, integer, pgEnum } from "drizzle-orm/pg-core";
import { account } from "./account.ts";

export const bankConnectionStatus = pgEnum("bank_connection_status", [
  "pending",
  "linked",
  "expired",
  "error",
]);

/** One GoCardless requisition per Budgie account - matches GoCardless's own
 * 1 requisition : 1 bank account model. `transactionsRemainingToday` /
 * `transactionsResetAt` cache the account-scoped rate-limit headers
 * GoCardless returns on every transactions call, so the "Sync now" button
 * can be disabled without spending a call to find out. */
export const bankConnection = pgTable("bank_connection", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .unique()
    .references(() => account.id, { onDelete: "cascade" }),
  institutionId: text("institution_id").notNull(),
  institutionName: text("institution_name").notNull(),
  requisitionId: text("requisition_id").notNull(),
  gocardlessAccountId: text("gocardless_account_id"),
  status: bankConnectionStatus("status").notNull().default("pending"),
  agreementExpiresAt: timestamp("agreement_expires_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  transactionsRemainingToday: integer("transactions_remaining_today"),
  transactionsResetAt: timestamp("transactions_reset_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
