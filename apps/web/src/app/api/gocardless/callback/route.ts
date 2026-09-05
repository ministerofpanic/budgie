import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";

import { completeBankLink } from "@/lib/dal/bank-connection";

/** The user lands here after authenticating at their bank's own hosted page
 * - Budgie's UI never touches bank credentials. GoCardless appends the
 * requisition's `ref` here too, but we identify the connection by the
 * `accountId` we put on the redirect URL when the requisition was created. */
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "Missing accountId" }, { status: 400 });

  await completeBankLink(accountId);
  redirect(`/accounts/${accountId}`);
}
