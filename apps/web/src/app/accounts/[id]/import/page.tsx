import { notFound } from "next/navigation";

import { getAccount } from "@/lib/dal/accounts";
import { getImportMapping, listImportBatches } from "@/lib/dal/import";
import { ImportWizard } from "@/components/import/import-wizard";

const ImportPage = async ({ params }: { readonly params: Promise<{ readonly id: string }> }) => {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [savedMapping, batches] = await Promise.all([getImportMapping(id), listImportBatches(id)]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <ImportWizard account={account} savedMapping={savedMapping} batches={batches} />
    </main>
  );
};

export default ImportPage;
