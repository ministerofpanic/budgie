import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { acceptInvite } from "@/lib/dal/sharing";
import { setActiveBudget } from "@/lib/dal/budget";

/**
 * A route handler, not a page - accepting an invite writes a cookie, and
 * Next.js only allows cookie writes from a Server Action or Route Handler,
 * never from a page component's render.
 *
 * The redirect origin comes from `NEXT_PUBLIC_APP_URL`, not `request.url` -
 * on Netlify a function's `request.url` reflects the deploy's internal
 * permalink host (`<deploy-id>--site.netlify.app`), not the custom domain
 * the browser is actually on, so redirecting to that origin drops the
 * session cookie the custom domain holds.
 */
export const GET = async (
  _request: Request,
  { params }: { readonly params: Promise<{ readonly token: string }> },
) => {
  await requireSession();
  const { token } = await params;
  const origin = process.env["NEXT_PUBLIC_APP_URL"];
  if (!origin) throw new Error("NEXT_PUBLIC_APP_URL is not set");

  const result = await acceptInvite(token);
  if (!result.ok) {
    const message =
      result.error.kind === "already-a-member" ? "already-a-member" : "invalid-or-expired";
    return NextResponse.redirect(`${origin}/budget?invite=${message}`);
  }

  await setActiveBudget(result.budgetId);
  return NextResponse.redirect(`${origin}/budget`);
};
