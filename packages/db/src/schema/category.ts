import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { budget } from "./budget.ts";
import { account } from "./account.ts";

export const categoryGroup = pgTable("category_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  budgetId: uuid("budget_id")
    .notNull()
    .references(() => budget.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budget.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => categoryGroup.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    hidden: boolean("hidden").notNull().default(false),
    /** Marks the one system category that receives a credit account's
     * automatic payment movements - see @budgie/budget's credit-card rules. */
    paymentForAccountId: uuid("payment_for_account_id").references(() => account.id, {
      onDelete: "cascade",
    }),
    /** Marks the one system category that inflow (income) transactions are
     * categorised to, so the engine can count them toward Ready to Assign. */
    isInflow: boolean("is_inflow").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("category_payment_for_account_uidx")
      .on(t.paymentForAccountId)
      .where(sql`${t.paymentForAccountId} is not null`),
  ],
);

export const categoryMonth = pgTable(
  "category_month",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    month: date("month").notNull(),
    assignedPence: integer("assigned_pence").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("category_month_category_month_idx").on(t.categoryId, t.month)],
);
