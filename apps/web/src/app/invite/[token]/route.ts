import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { acceptInvite } from "@/lib/dal/sharing";
import { setActiveBudget } from "@/lib/dal/budget";

/**
 * A route handler, not a page - accepting an invite writes a cookie, and
 * Next.js only allows cookie writes from a Server Action or Route Handler,
 * never from a page component's render.
 */
export const GET = async (
  request: Request,
  { params }: { readonly params: Promise<{ readonly token: string }> },
) => {
  await requireSession();
  const { token } = await params;
  const { origin } = new URL(request.url);

  const result = await acceptInvite(token);
  if (!result.ok) {
    const message =
      result.error.kind === "already-a-member" ? "already-a-member" : "invalid-or-expired";
    return NextResponse.redirect(`${origin}/budget?invite=${message}`);
  }

  await setActiveBudget(result.budgetId);
  return NextResponse.redirect(`${origin}/budget`);
};
