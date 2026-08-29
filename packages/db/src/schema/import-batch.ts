import { pgTable, text, timestamp, uuid, integer, jsonb, boolean } from "drizzle-orm/pg-core";
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

/** One remembered column mapping per account, so re-importing from the same
 * bank doesn't ask the user to map columns again. `columnMapping` mirrors
 * `@budgie/core/csv`'s `ColumnMapping` type - kept as opaque JSON here since
 * the DB layer has no business validating its shape, only storing it. */
export const importMapping = pgTable("import_mapping", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .unique()
    .references(() => account.id, { onDelete: "cascade" }),
  delimiter: text("delimiter").notNull(),
  dateFormat: text("date_format").notNull(),
  hasHeaderRow: boolean("has_header_row").notNull(),
  columnMapping: jsonb("column_mapping").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
