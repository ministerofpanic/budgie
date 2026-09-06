import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAccount } from "@/lib/dal/accounts";
import { listInstitutions } from "@/lib/dal/bank-connection";
import { LinkBankForm } from "@/components/register/link-bank-form";

export const generateMetadata = async ({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  const account = await getAccount(id);
  return { title: `Link bank · ${account?.name ?? "Account"}` };
};

const LinkBankPage = async ({ params }: { readonly params: Promise<{ readonly id: string }> }) => {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const institutions = await listInstitutions();

  return <LinkBankForm account={account} institutions={institutions} />;
};

export default LinkBankPage;
