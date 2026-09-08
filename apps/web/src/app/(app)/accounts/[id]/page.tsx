import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAccount, listAccounts } from "@/lib/dal/accounts";
import { listForAccount, pageSizes, type PageSize } from "@/lib/dal/transactions";
import { listCategoryGroups } from "@/lib/dal/categories";
import { getBankConnection } from "@/lib/dal/bank-connection";
import { requireBudget } from "@/lib/dal/budget";
import { Register } from "@/components/register/register";

export const generateMetadata = async ({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  const account = await getAccount(id);
  return { title: account?.name ?? "Account" };
};

const parsePage = (raw: string | undefined): number => {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
};

const parsePageSize = (raw: string | undefined): PageSize => {
  const parsed = Number(raw);
  return (pageSizes as readonly number[]).includes(parsed) ? (parsed as PageSize) : 50;
};

const AccountPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<{
    readonly page?: string;
    readonly pageSize?: string;
    readonly q?: string;
  }>;
}) => {
  const { id } = await params;
  const query = await searchParams;
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize);
  const search = query.q;

  const account = await getAccount(id);
  if (!account) notFound();

  const [{ rows: transactions, totalCount }, groups, accounts, bankConnection, { currency }] =
    await Promise.all([
      listForAccount({ accountId: id, page, pageSize, ...(search ? { search } : {}) }),
      listCategoryGroups(),
      listAccounts(),
      getBankConnection(id),
      requireBudget(),
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
      budgetCurrency={currency}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      search={search ?? ""}
    />
  );
};

export default AccountPage;
