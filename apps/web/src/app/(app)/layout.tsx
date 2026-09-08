import { getAppShellData } from "@/lib/dal/app-shell";
import { AppHeader } from "@/components/app-header";
import { OfflineGate } from "@/components/offline/offline-gate";

const AppShellLayout = async ({ children }: { readonly children: React.ReactNode }) => {
  const shell = await getAppShellData();

  return (
    <>
      <AppHeader {...shell} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
        <OfflineGate budgetId={shell.activeBudgetId}>{children}</OfflineGate>
      </main>
    </>
  );
};

export default AppShellLayout;
