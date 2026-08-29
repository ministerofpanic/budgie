import { pgTable, text, timestamp, uuid, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { budget } from "./budget.ts";
import { user } from "./auth.ts";

export const budgetMemberRole = pgEnum("budget_member_role", ["owner", "editor", "viewer"]);

export const budgetMember = pgTable(
  "budget_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budget.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: budgetMemberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("budget_member_budget_user_idx").on(t.budgetId, t.userId)],
);

export const budgetInvite = pgTable("budget_invite", {
  id: uuid("id").primaryKey().defaultRandom(),
  budgetId: uuid("budget_id")
    .notNull()
    .references(() => budget.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  role: budgetMemberRole("role").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
