import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export const getSession = async (): Promise<Session> =>
  auth.api.getSession({ headers: await headers() });

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
