import { autoEnterDue, listUpcoming } from "@/lib/dal/scheduled-transactions";
import { listAccounts } from "@/lib/dal/accounts";
import { listCategoryGroups } from "@/lib/dal/categories";
import { ScheduledList } from "@/components/scheduled/scheduled-list";

const ScheduledPage = async () => {
  await autoEnterDue();

  const [upcoming, accounts, groups] = await Promise.all([
    listUpcoming(),
    listAccounts(),
    listCategoryGroups(),
  ]);

  const categoryOptions = groups.flatMap((group) =>
    group.categories
      .filter((category) => !category.hidden)
      .map((category) => ({ id: category.id, name: `${group.name}: ${category.name}` })),
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <ScheduledList upcoming={upcoming} accounts={accounts} categoryOptions={categoryOptions} />
    </main>
  );
};

export default ScheduledPage;
