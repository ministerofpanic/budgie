import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Placeholder for Better Auth's own tables (user, session, account,
 * verification, passkey). Phase 03 regenerates this file with the Better
 * Auth CLI rather than hand-editing it - this stub exists only so
 * budget_member and other tables have a `user.id` to reference in phase 02.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
