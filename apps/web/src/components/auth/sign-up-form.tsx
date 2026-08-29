"use client";

import { useState } from "react";
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

  // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          autoComplete="name"
          required
          value={name}
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Create account with a passkey"}
      </Button>
    </form>
  );
};

export { SignUpForm };
