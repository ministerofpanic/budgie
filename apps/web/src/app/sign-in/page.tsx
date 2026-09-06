import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

const SignInPage = () => (
  <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-16">
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use the passkey registered on this device.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SignInForm />
        <p className="text-muted-foreground text-sm">
          New to Budgie?{" "}
          <Link href="/sign-up" className="text-primary underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  </main>
);

export default SignInPage;
