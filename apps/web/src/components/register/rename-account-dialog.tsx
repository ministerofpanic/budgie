"use client";

import { useCallback, useState, useTransition } from "react";

import { renameAccountAction } from "@/lib/actions/budget-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const RenameAccountDialog = ({
  open,
  onOpenChange,
  accountId,
  currentName,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly accountId: string;
  readonly currentName: string;
}) => {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) setName(currentName);
      setError(null);
      onOpenChange(nextOpen);
    },
    [currentName, onOpenChange],
  );

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      startTransition(async () => {
        try {
          await renameAccountAction(accountId, name);
          onOpenChange(false);
        } catch {
          setError("Could not rename that account.");
        }
      });
    },
    [accountId, name, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Rename account</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            <Label htmlFor="rename-account-name">Name</Label>
            <Input id="rename-account-name" value={name} onChange={handleNameChange} autoFocus />
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim() || name.trim() === currentName}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
