import { notFound } from "next/navigation";

import { getAccount } from "@/lib/dal/accounts";
import { listInstitutions } from "@/lib/dal/bank-connection";
import { LinkBankForm } from "@/components/register/link-bank-form";

const LinkBankPage = async ({ params }: { readonly params: Promise<{ readonly id: string }> }) => {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const institutions = await listInstitutions();

  return <LinkBankForm account={account} institutions={institutions} />;
};

export default LinkBankPage;
