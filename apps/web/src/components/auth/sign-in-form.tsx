"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WebAuthnAbortService } from "@simplewebauthn/browser";

import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SignInForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Conditional UI: the browser shows the account's saved passkeys inline
    // in its native autofill dropdown as soon as the email field is
    // focused - there's no button to click. A separate manual fallback
    // would race this request for the same server-side challenge cookie,
    // so this is the only sign-in path.
    const startedAt = Date.now();
    const runConditionalSignIn = async () => {
      const result = await authClient.signIn.passkey({ autoFill: true });
      if (result.data) {
        router.push("/account/passkeys");
        return;
      }
      if (!result.error) return;

      // WebAuthn can't distinguish "no passkey exists for this origin" from
      // a genuine user cancel at the API level - both surface as the same
      // NotAllowedError, by spec design (so a site can't probe which
      // accounts exist). The browser resolves near-instantly when there's
      // simply nothing to offer (e.g. a passkey registered for production
      // being tried against localhost), whereas an actual dismissed picker
      // takes long enough for a person to see and close it. Only surface an
      // error once enough time has passed to make that plausible.
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < 1000) return;
      setError(result.error.message ?? "Could not sign you in.");
    };
    void runConditionalSignIn();

    // Conditional UI has no natural end - the browser keeps listening until
    // a credential is picked. If this component unmounts while that's still
    // outstanding (navigating to sign-up, a hard reload mid-request), cancel
    // it explicitly - otherwise the browser can still consider a WebAuthn
    // ceremony "pending" and reject the next one (registration on sign-up,
    // or a second sign-in attempt) with "A request is already pending."
    return () => WebAuthnAbortService.cancelCeremony();
  }, [router]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="username webauthn" />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
};

export { SignInForm };
