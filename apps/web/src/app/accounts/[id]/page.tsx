import { notFound } from "next/navigation";

import { getAccount } from "@/lib/dal/accounts";
import { listForAccount } from "@/lib/dal/transactions";
import { listCategoryGroups } from "@/lib/dal/categories";
import { getAppShellData } from "@/lib/dal/app-shell";
import { AppHeader } from "@/components/app-header";
import { Register } from "@/components/register/register";

const AccountPage = async ({ params }: { readonly params: Promise<{ readonly id: string }> }) => {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [transactions, groups, shell] = await Promise.all([
    listForAccount(id),
    listCategoryGroups(),
    getAppShellData(),
  ]);

  const categoryOptions = groups.flatMap((group) =>
    group.categories
      .filter((category) => !category.hidden)
      .map((category) => ({ id: category.id, name: `${group.name}: ${category.name}` })),
  );

  return (
    <>
      <AppHeader {...shell} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Register
          account={account}
          accounts={shell.accounts}
          transactions={transactions}
          categoryOptions={categoryOptions}
        />
      </main>
    </>
  );
};

export default AccountPage;
