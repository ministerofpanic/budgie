import { requireSession } from "@/lib/session";
import { listPasskeys } from "@/lib/passkeys";
import { PasskeyManager } from "@/components/auth/passkey-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PasskeysPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly welcome?: string }>;
}) => {
  const session = await requireSession();
  // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- server component, never re-renders
  const passkeys = (await listPasskeys()) ?? [];
  const { welcome } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Your passkeys</CardTitle>
          <CardDescription>
            {welcome
              ? `Welcome, ${session.user.name}. Add a second passkey now - losing your only one means losing the account.`
              : "Manage the passkeys signed in to this account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeyManager initialPasskeys={passkeys} />
        </CardContent>
      </Card>
    </main>
  );
};

export default PasskeysPage;
