import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { budget } from "./budget.ts";
import { account } from "./account.ts";

export const importBatch = pgTable("import_batch", {
  id: uuid("id").primaryKey().defaultRandom(),
  budgetId: uuid("budget_id")
    .notNull()
    .references(() => budget.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  rowCount: integer("row_count").notNull(),
});
