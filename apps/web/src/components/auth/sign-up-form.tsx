"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SignUpForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  }, []);

  const handleEmailChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setPending(true);

      const { error: signUpError } = await authClient.passkey.addPasskey({
        name: "First passkey",
        context: JSON.stringify({ name, email }),
        createSession: true,
      });

      setPending(false);

      if (signUpError) {
        setError(signUpError.message ?? "Could not create your account. Try again.");
        return;
      }

      router.push("/account/passkeys?welcome=1");
    },
    [name, email, router],
  );

  const sendMagicLink = useCallback(async () => {
    setError(null);
    setMagicLinkPending(true);
    const { error: magicLinkError } = await authClient.signIn.magicLink({
      email,
      name,
      callbackURL: "/account/passkeys?welcome=1",
    });
    setMagicLinkPending(false);
    if (magicLinkError) {
      setError(magicLinkError.message ?? "Could not send the sign-up email. Try again.");
      return;
    }
    setMagicLinkSent(true);
  }, [email, name]);

  if (magicLinkSent) {
    return (
      <p className="text-sm">
        Check <strong>{email}</strong> for a link to finish creating your account. It expires in 5
        minutes.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" autoComplete="name" required value={name} onChange={handleNameChange} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={handleEmailChange}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" loading={pending}>
        {pending ? "Creating account..." : "Create account with a passkey"}
      </Button>
      <Button
        type="button"
        variant="outline"
        loading={magicLinkPending}
        disabled={!name || !email}
        onClick={sendMagicLink}
      >
        Email me a link instead
      </Button>
      <p className="text-muted-foreground text-xs">
        No passkey support on this device or browser? Use email instead - you can always add a
        passkey later from a device that supports one.
      </p>
    </form>
  );
};

export { SignUpForm };
