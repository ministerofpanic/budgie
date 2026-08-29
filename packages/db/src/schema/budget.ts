import { pgTable, text, timestamp, date, uuid } from "drizzle-orm/pg-core";

export const budget = pgTable("budget", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("GBP"),
  firstMonth: date("first_month").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
