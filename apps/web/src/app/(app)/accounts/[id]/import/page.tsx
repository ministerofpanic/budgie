import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAccount } from "@/lib/dal/accounts";
import { getImportMapping, listImportBatches } from "@/lib/dal/import";
import { ImportWizard } from "@/components/import/import-wizard";

export const generateMetadata = async ({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  const account = await getAccount(id);
  return { title: `Import · ${account?.name ?? "Account"}` };
};

const ImportPage = async ({ params }: { readonly params: Promise<{ readonly id: string }> }) => {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [savedMapping, batches] = await Promise.all([getImportMapping(id), listImportBatches(id)]);

  return <ImportWizard account={account} savedMapping={savedMapping} batches={batches} />;
};

export default ImportPage;
