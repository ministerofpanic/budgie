import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/lib/session";
import { listPasskeys } from "@/lib/passkeys";
import { PasskeyManager } from "@/components/auth/passkey-manager";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Passkeys" };
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// A stable reference rather than an inline `[]` fallback, so the array
// passed to PasskeyManager is never a fresh literal.
const NO_PASSKEYS: readonly Awaited<ReturnType<typeof listPasskeys>>[number][] = [];

const PasskeysPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly welcome?: string }>;
}) => {
  const session = await requireSession();
  const passkeys = (await listPasskeys()) ?? NO_PASSKEYS;
  const { welcome } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Your passkeys</CardTitle>
          <CardDescription>
            {welcome
              ? passkeys.length === 0
                ? `Welcome, ${session.user.name}. If this device supports it, adding a passkey means faster sign-in next time - optional, and you can always add one later from here.`
                : `Welcome, ${session.user.name}. A second passkey is optional, but worth adding - losing your only one means losing the account. You can always add one later from here.`
              : "Manage the passkeys signed in to this account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PasskeyManager initialPasskeys={passkeys} />
          <Button asChild variant="outline">
            <Link href="/budget">Continue to your budget</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasskeysPage;
