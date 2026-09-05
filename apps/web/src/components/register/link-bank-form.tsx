"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AccountRow } from "@/lib/dal/accounts";
import type { InstitutionOption } from "@/lib/dal/bank-connection";
import { startBankLinkAction } from "@/lib/actions/bank-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const LinkBankForm = ({
  account,
  institutions,
}: {
  readonly account: AccountRow;
  readonly institutions: readonly InstitutionOption[];
}) => {
  const router = useRouter();
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const link = useCallback(() => {
    const institution = institutions.find((option) => option.id === institutionId);
    if (!institution) return;

    setError(null);
    startTransition(async () => {
      try {
        const { link: consentUrl } = await startBankLinkAction(
          account.id,
          institution.id,
          institution.name,
        );
        window.location.href = consentUrl;
      } catch (thrown) {
        setError(thrown instanceof Error ? thrown.message : "Failed to start bank link.");
      }
    });
  }, [account.id, institutionId, institutions]);

  const cancel = useCallback(() => router.back(), [router]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <p className="text-xl font-semibold">Link a bank account</p>
        <p className="text-muted-foreground text-sm">
          Connect {account.name} to your bank via Open Banking (GoCardless). You&apos;ll
          authenticate directly with your bank - Budgie never sees your bank credentials.
        </p>
      </div>

      <Select {...(institutionId ? { value: institutionId } : {})} onValueChange={setInstitutionId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose your bank" />
        </SelectTrigger>
        <SelectContent>
          {institutions.map((institution) => (
            <SelectItem key={institution.id} value={institution.id}>
              {institution.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={cancel}>
          Cancel
        </Button>
        <Button type="button" disabled={!institutionId || pending} onClick={link}>
          {pending ? "Connecting…" : "Continue to your bank"}
        </Button>
      </div>
    </div>
  );
};
