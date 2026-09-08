"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { OfflineSnapshot } from "@/lib/dal/offline";
import type { ConflictEntry } from "@/lib/offline/db";
import { listConflicts, loadSnapshot, syncNow } from "@/lib/offline/sync";
import { OfflineBudgetView } from "@/components/offline/offline-budget-view";
import { OfflineRegisterView } from "@/components/offline/offline-register-view";
import { ConflictsBanner } from "@/components/offline/conflicts-banner";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Mirrors the budget into IndexedDB while online and swaps in an offline
 * view for the budget grid and register when the browser goes offline;
 * other children render normally. */
const OfflineGate = ({
  budgetId,
  children,
}: {
  readonly budgetId: string;
  readonly children: React.ReactNode;
}) => {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [conflicts, setConflicts] = useState<readonly ConflictEntry[]>([]);

  const refreshConflicts = useCallback(async () => {
    try {
      setConflicts(await listConflicts(budgetId));
    } catch {
      // Best-effort - a failed local read isn't worth surfacing.
    }
  }, [budgetId]);

  const trySync = useCallback(async () => {
    try {
      await syncNow(budgetId);
      const [snap, conf] = await Promise.all([loadSnapshot(budgetId), listConflicts(budgetId)]);
      if (snap) setSnapshot(snap);
      setConflicts(conf);
    } catch {
      // Offline, or the server rejected the sync - the next scheduled
      // attempt (reconnect, foreground, timer) will retry.
    }
  }, [budgetId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void trySync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void trySync();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    void trySync();
    void refreshConflicts();
    const interval = setInterval(() => {
      if (navigator.onLine) void trySync();
    }, SYNC_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [trySync, refreshConflicts]);

  useEffect(() => {
    if (isOnline || snapshot) return;
    loadSnapshot(budgetId)
      .then((snap) => {
        if (snap) setSnapshot(snap);
        return undefined;
      })
      .catch(() => undefined);
  }, [isOnline, snapshot, budgetId]);

  const conflictsBanner =
    conflicts.length > 0 ? (
      <ConflictsBanner conflicts={conflicts} onResolved={refreshConflicts} />
    ) : null;

  if (!isOnline && snapshot) {
    const accountMatch = /^\/accounts\/([^/]+)/.exec(pathname);
    if (pathname === "/budget") {
      return (
        <>
          {conflictsBanner}
          <OfflineBudgetView snapshot={snapshot} onChange={setSnapshot} />
        </>
      );
    }
    if (accountMatch?.[1]) {
      return (
        <>
          {conflictsBanner}
          <OfflineRegisterView
            snapshot={snapshot}
            accountId={accountMatch[1]}
            onChange={setSnapshot}
          />
        </>
      );
    }
  }

  return (
    <>
      {conflictsBanner}
      {children}
    </>
  );
};

export { OfflineGate };
