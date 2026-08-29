import { notFound } from "next/navigation";

import { getAccount, listAccounts } from "@/lib/dal/accounts";
import { listForAccount } from "@/lib/dal/transactions";
import { listCategoryGroups } from "@/lib/dal/categories";
import { Register } from "@/components/register/register";

const AccountPage = async ({ params }: { readonly params: Promise<{ readonly id: string }> }) => {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [transactions, groups, accounts] = await Promise.all([
    listForAccount(id),
    listCategoryGroups(),
    listAccounts(),
  ]);

  const categoryOptions = groups.flatMap((group) =>
    group.categories
      .filter((category) => !category.hidden)
      .map((category) => ({ id: category.id, name: `${group.name}: ${category.name}` })),
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Register
        account={account}
        accounts={accounts}
        transactions={transactions}
        categoryOptions={categoryOptions}
      />
    </main>
  );
};

export default AccountPage;
