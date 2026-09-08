"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WebAuthnAbortService } from "@simplewebauthn/browser";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SignInForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    // Conditional UI: the browser shows the account's saved passkeys inline
    // in its native autofill dropdown as soon as the email field is
    // focused - there's no button to click for this first attempt. If it
    // fails, the "Try again" button below triggers the same sign-in with
    // autoFill off instead, which pops the full picker immediately.
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

  const handleEmailChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setPending(true);
    // The failed conditional request has already resolved by the time this
    // button is visible, but cancel defensively in case the browser still
    // considers it outstanding - see the effect cleanup above for why.
    WebAuthnAbortService.cancelCeremony();

    void (async () => {
      const result = await authClient.signIn.passkey();
      setPending(false);
      if (result.data) {
        router.push("/account/passkeys");
        return;
      }
      if (result.error) setError(result.error.message ?? "Could not sign you in.");
    })();
  }, [router]);

  const sendMagicLink = useCallback(async () => {
    setError(null);
    setMagicLinkPending(true);
    const { error: magicLinkError } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/account/passkeys",
    });
    setMagicLinkPending(false);
    if (magicLinkError) {
      setError(magicLinkError.message ?? "Could not send the sign-in email. Try again.");
      return;
    }
    setMagicLinkSent(true);
  }, [email]);

  if (magicLinkSent) {
    return (
      <p className="text-sm">
        Check <strong>{email}</strong> for a sign-in link. It expires in 5 minutes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username webauthn"
          value={email}
          onChange={handleEmailChange}
        />
      </div>
      {error ? (
        <div className="flex flex-col gap-2">
          <p className="text-destructive text-sm">{error}</p>
          <Button type="button" variant="outline" loading={pending} onClick={retry}>
            Try again
          </Button>
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        loading={magicLinkPending}
        disabled={!email}
        onClick={sendMagicLink}
      >
        Email me a link instead
      </Button>
      <p className="text-muted-foreground text-xs">
        No passkey support on this device or browser? Use email instead.
      </p>
    </div>
  );
};

export { SignInForm };
