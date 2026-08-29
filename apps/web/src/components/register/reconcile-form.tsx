"use client";

import { useCallback, useState, useTransition } from "react";

import { format, unsafePence } from "@budgie/core/money";
import { reconcileAccountAction } from "@/lib/actions/import-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const money = (pence: number) => format(unsafePence(pence));

const ReconcileForm = ({
  accountId,
  onDone,
}: {
  readonly accountId: string;
  readonly onDone: () => void;
}) => {
  const [realBalance, setRealBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setRealBalance(event.target.value),
    [],
  );

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      startTransition(async () => {
        const outcome = await reconcileAccountAction(accountId, realBalance);
        if (!outcome.ok) {
          setError("Enter a valid amount.");
          return;
        }
        setResult(
          outcome.value.adjustmentPence === 0
            ? "Already balanced - all cleared transactions are now locked."
            : `Created a ${money(outcome.value.adjustmentPence)} adjustment. Cleared transactions are now locked.`,
        );
      });
    },
    [accountId, realBalance],
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border p-3">
      <Label htmlFor="real-balance">Real-world balance</Label>
      <Input id="real-balance" inputMode="decimal" value={realBalance} onChange={handleChange} />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {result ? <p className="text-sm">{result}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Reconcile
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
    </form>
  );
};

export { ReconcileForm };
