"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    const runConditionalSignIn = async () => {
      const result = await authClient.signIn.passkey({ autoFill: true });
      if (result.data) router.push("/account/passkeys");
      else if (result.error) setError(result.error.message ?? "Could not sign you in.");
    };
    void runConditionalSignIn();
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
