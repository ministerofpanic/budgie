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

const commonCurrencies = ["GBP", "USD", "EUR", "CAD", "AUD", "CHF", "JPY", "NZD"] as const;

const NewAccountDialog = ({
  open,
  onOpenChange,
  defaultCurrency,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly defaultCurrency: string;
}) => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("current");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );
  const handleTypeChange = useCallback((value: string) => setType(value as AccountType), []);
  const handleCurrencyChange = useCallback((value: string) => setCurrency(value), []);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      startTransition(async () => {
        try {
          const account = await createAccountAction(name, type, currency);
          onOpenChange(false);
          setName("");
          setType("current");
          setCurrency(defaultCurrency);
          router.push(`/accounts/${account.id}`);
        } catch {
          setError("Could not create that account.");
        }
      });
    },
    [name, type, currency, defaultCurrency, onOpenChange, router],
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

          <div className="flex flex-col gap-1">
            <Label htmlFor="new-account-currency">Currency</Label>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger id="new-account-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {commonCurrencies.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currency !== defaultCurrency ? (
              <p className="text-muted-foreground text-xs">
                This budget's home currency is {defaultCurrency}. Transactions on this account will
                be converted for budgeting and reports, using an exchange rate you can always edit.
              </p>
            ) : null}
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
