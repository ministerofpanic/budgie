import { notFound } from "next/navigation";

import { getAccount, listAccounts } from "@/lib/dal/accounts";
import { listForAccount } from "@/lib/dal/transactions";
import { listCategoryGroups } from "@/lib/dal/categories";
import { getBankConnection } from "@/lib/dal/bank-connection";
import { Register } from "@/components/register/register";

const AccountPage = async ({ params }: { readonly params: Promise<{ readonly id: string }> }) => {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [transactions, groups, accounts, bankConnection] = await Promise.all([
    listForAccount(id),
    listCategoryGroups(),
    listAccounts(),
    getBankConnection(id),
  ]);

  const categoryOptions = groups.flatMap((group) =>
    group.categories
      .filter((category) => !category.hidden)
      .map((category) => ({ id: category.id, name: `${group.name}: ${category.name}` })),
  );

  return (
    <Register
      account={account}
      accounts={accounts}
      transactions={transactions}
      categoryOptions={categoryOptions}
      bankConnection={bankConnection ?? null}
    />
  );
};

export default AccountPage;
