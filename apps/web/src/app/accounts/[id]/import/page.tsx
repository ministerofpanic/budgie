import { notFound } from "next/navigation";

import { getAccount } from "@/lib/dal/accounts";
import { getImportMapping, listImportBatches } from "@/lib/dal/import";
import { getAppShellData } from "@/lib/dal/app-shell";
import { AppHeader } from "@/components/app-header";
import { ImportWizard } from "@/components/import/import-wizard";

const ImportPage = async ({ params }: { readonly params: Promise<{ readonly id: string }> }) => {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [savedMapping, batches, shell] = await Promise.all([
    getImportMapping(id),
    listImportBatches(id),
    getAppShellData(),
  ]);

  return (
    <>
      <AppHeader {...shell} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
        <ImportWizard account={account} savedMapping={savedMapping} batches={batches} />
      </main>
    </>
  );
};

export default ImportPage;
