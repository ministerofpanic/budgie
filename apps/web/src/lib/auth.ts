import { randomUUID } from "node:crypto";

import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { db, schema } from "@budgie/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set - copy .env.example to .env and fill it in.`);
  return value;
};

const signUpContext = z.object({ email: z.string().email(), name: z.string().min(1) });

export const auth = betterAuth({
  appName: "Budgie",
  baseURL: env("NEXT_PUBLIC_APP_URL"),
  secret: env("BETTER_AUTH_SECRET"),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Our own budgeting `account` table (bank/credit accounts) already owns the
  // "account" name - Better Auth's OAuth-linked-account table gets a
  // different one so the two never collide in packages/db/src/schema.
  account: { modelName: "authAccount" },
  plugins: [
    passkey({
      rpID: env("PASSKEY_RP_ID"),
      rpName: env("PASSKEY_RP_NAME"),
      origin: env("NEXT_PUBLIC_APP_URL"),
      registration: {
        // No session is required to register the *first* passkey: a brand new
        // account is created from `context`. Adding a second (or subsequent)
        // passkey always goes through the authenticated-session path instead,
        // so an attacker can never attach a passkey to somebody else's email -
        // resolveUser only ever creates a fresh user, never reuses one.
        requireSession: false,
        resolveUser: async ({ context }) => {
          const parsed = signUpContext.safeParse(JSON.parse(context ?? "null"));
          if (!parsed.success) {
            throw new APIError("BAD_REQUEST", { message: "Name and email are required." });
          }

          const existing = await db.query.user.findFirst({
            where: eq(schema.user.email, parsed.data.email),
          });
          if (existing) {
            throw new APIError("UNPROCESSABLE_ENTITY", {
              message: "An account with this email already exists - sign in instead.",
            });
          }

          const [created] = await db
            .insert(schema.user)
            .values({ id: randomUUID(), name: parsed.data.name, email: parsed.data.email })
            .returning();
          if (!created) throw new APIError("INTERNAL_SERVER_ERROR");

          return { id: created.id, name: created.name, displayName: created.name };
        },
      },
    }),
    nextCookies(),
  ],
});
