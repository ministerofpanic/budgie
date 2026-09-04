"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { createAccountAction } from "@/lib/actions/budget-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const accountTypeLabel = {
  current: "Current account",
  savings: "Savings account",
  cash: "Cash",
  credit: "Credit card",
  tracking: "Tracking (off-budget)",
} as const;

type AccountType = keyof typeof accountTypeLabel;

const NewAccountDialog = ({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("current");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );
  const handleTypeChange = useCallback((value: string) => setType(value as AccountType), []);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      startTransition(async () => {
        try {
          const account = await createAccountAction(name, type);
          onOpenChange(false);
          setName("");
          setType("current");
          router.push(`/accounts/${account.id}`);
        } catch {
          setError("Could not create that account.");
        }
      });
    },
    [name, type, onOpenChange, router],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New account</DialogTitle>
            <DialogDescription>
              A credit card also gets a payment category, so spending on it moves budgeted money
              rather than leaving the category it was spent from.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            <Label htmlFor="new-account-name">Name</Label>
            <Input id="new-account-name" value={name} onChange={handleNameChange} autoFocus />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="new-account-type">Type</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger id="new-account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(accountTypeLabel) as AccountType[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {accountTypeLabel[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              <Plus className="size-4" />
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { NewAccountDialog };
