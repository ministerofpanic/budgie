import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { budget } from "./budget.ts";
import { account } from "./account.ts";

export const payee = pgTable(
  "payee",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budget.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    transferAccountId: uuid("transfer_account_id").references(() => account.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payee_budget_name_idx").on(t.budgetId, t.name)],
);
