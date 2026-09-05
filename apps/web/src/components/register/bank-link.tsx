"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { Landmark, RefreshCw } from "lucide-react";

import type { BankConnectionRow } from "@/lib/dal/bank-connection";
import { syncBankTransactionsAction } from "@/lib/actions/bank-actions";
import { Button } from "@/components/ui/button";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const BankLink = ({
  accountId,
  bankConnection,
}: {
  readonly accountId: string;
  readonly bankConnection: BankConnectionRow | null;
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        await syncBankTransactionsAction(accountId);
      } catch (thrown) {
        setError(thrown instanceof Error ? thrown.message : "Sync failed.");
      }
    });
  }, [accountId]);

  if (!bankConnection || bankConnection.status !== "linked") {
    return (
      <Button asChild type="button" size="sm" variant="outline">
        <Link href={`/accounts/${accountId}/link-bank`}>
          <Landmark className="size-3.5" />
          Link bank
        </Link>
      </Button>
    );
  }

  // `bankConnection` is loaded fresh from the DB on every page render (server
  // component fetch, not client state), so a resetAt already in the past
  // simply means the next page load will show a fresh (non-zero) remaining
  // count - no need to compare against the current time here.
  const limitReached =
    bankConnection.transactionsRemainingToday !== null &&
    bankConnection.transactionsRemainingToday <= 0 &&
    bankConnection.transactionsResetAt !== null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">
        {bankConnection.institutionName}
        {bankConnection.lastSyncedAt
          ? ` · synced ${formatTime(bankConnection.lastSyncedAt)}`
          : " · never synced"}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={sync}
        disabled={pending || limitReached}
        title={
          limitReached && bankConnection.transactionsResetAt
            ? `Daily sync limit reached - resets ${formatTime(bankConnection.transactionsResetAt)}`
            : undefined
        }
      >
        <RefreshCw className="size-3.5" />
        {pending ? "Syncing…" : "Sync now"}
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
};
