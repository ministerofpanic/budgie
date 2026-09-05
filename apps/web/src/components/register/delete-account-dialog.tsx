"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { closeAccountAction, deleteAccountAction } from "@/lib/actions/budget-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const DeleteAccountDialog = ({
  open,
  onOpenChange,
  accountId,
  accountName,
  hasTransactions,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly accountId: string;
  readonly accountName: string;
  readonly hasTransactions: boolean;
}) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        await closeAccountAction(accountId);
        onOpenChange(false);
        router.push("/budget");
      } catch {
        setError("Could not close that account.");
      }
    });
  }, [accountId, onOpenChange, router]);

  const deletePermanently = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAccountAction(accountId);
        onOpenChange(false);
        router.push("/budget");
      } catch {
        setError("Could not delete that account.");
      }
    });
  }, [accountId, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {accountName}?</DialogTitle>
          <DialogDescription>
            {hasTransactions
              ? "This account has transactions, so it can only be closed - closing hides it from the account list and stops new transactions, but keeps its history and budget impact intact."
              : "This account has no transactions yet, so you can either close it (reversible, keeps it around but hidden) or permanently delete it."}
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={pending}>
            Close account
          </Button>
          {hasTransactions ? null : (
            <Button
              type="button"
              variant="destructive"
              onClick={deletePermanently}
              disabled={pending}
            >
              <Trash2 className="size-4" />
              Delete permanently
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
