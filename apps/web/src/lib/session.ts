import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * `cache()` dedupes this within a single request - a page and every DAL call
 * it makes down the tree call `getSession`/`requireBudget` independently, and
 * without this each one would be its own round trip to the auth tables.
 */
export const getSession = cache(async (): Promise<Session> =>
  auth.api.getSession({ headers: await headers() }),
);

/**
 * Every server component or action behind a login wall calls this rather
 * than checking the session itself, so route protection lives in one place
 * instead of being re-implemented per page.
 */
export const requireSession = async (): Promise<NonNullable<Session>> => {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
};
