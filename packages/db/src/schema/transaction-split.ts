import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { transaction } from "./transaction.ts";
import { category } from "./category.ts";

export const transactionSplit = pgTable("transaction_split", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transaction.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => category.id, { onDelete: "cascade" }),
  amountPence: integer("amount_pence").notNull(),
  memo: text("memo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
