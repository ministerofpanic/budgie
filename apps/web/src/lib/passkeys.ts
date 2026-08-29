"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";

export const listPasskeys = async () => {
  await requireSession();
  return auth.api.listPasskeys({ headers: await headers() });
};

export const renamePasskey = async (id: string, name: string): Promise<{ ok: true }> => {
  await requireSession();
  await auth.api.updatePasskey({ headers: await headers(), body: { id, name } });
  return { ok: true };
};

export const revokePasskey = async (
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  await requireSession();
  const requestHeaders = await headers();

  const existing = await auth.api.listPasskeys({ headers: requestHeaders });
  if ((existing?.length ?? 0) <= 1) {
    return { ok: false, error: "You can't revoke your last passkey - it's the only way in." };
  }

  await auth.api.deletePasskey({ headers: requestHeaders, body: { id } });
  return { ok: true };
};
