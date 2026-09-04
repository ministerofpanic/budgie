import Link from "next/link";

import { getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";

const HomePage = async () => {
  const session = await getSession();
  const primaryHref = session ? "/budget" : "/sign-up";

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">Budgie</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Give every pound a job, before you spend it.
        </h1>
        <p className="text-muted-foreground">
          Self-hosted budgeting, shared with the people you budget with. Passkey sign-in, no
          subscription, no ads, no selling your data.
        </p>
      </header>

      <div className="flex gap-3">
        <Button asChild>
          <Link href={primaryHref}>{session ? "Go to your budget" : "Get started"}</Link>
        </Button>
        {session ? null : (
          <Button asChild variant="outline">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </main>
  );
};

export default HomePage;
