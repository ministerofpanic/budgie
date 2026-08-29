import { Money } from "@budgie/core";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const readyToAssign = Money.unsafePence(124_350);

const HomePage = () => (
  <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6 py-16">
    <header className="flex flex-col gap-2">
      <p className="text-primary text-xs font-semibold tracking-widest uppercase">Budgie</p>
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        Envelope budgeting you actually own.
      </h1>
      <p className="text-muted-foreground">
        Scaffold is up. Passkey sign-in and the budget engine land next.
      </p>
    </header>

    <Card>
      <CardHeader>
        <CardDescription>Ready to assign</CardDescription>
        <CardTitle className="tabular text-money-positive text-3xl">
          {Money.format(readyToAssign)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button disabled>Assign it (coming next)</Button>
      </CardContent>
    </Card>
  </main>
);

export default HomePage;
