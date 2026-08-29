import { pgTable, timestamp, uuid, integer, date, pgEnum } from "drizzle-orm/pg-core";
import { category } from "./category.ts";

export const targetType = pgEnum("target_type", ["monthly", "by-date", "refill", "spending"]);
export const targetCadence = pgEnum("target_cadence", ["monthly", "yearly"]);

export const target = pgTable("target", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => category.id, { onDelete: "cascade" }),
  type: targetType("type").notNull(),
  amountPence: integer("amount_pence").notNull(),
  dueDate: date("due_date"),
  cadence: targetCadence("cadence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
