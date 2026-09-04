import { autoEnterDue, listUpcoming } from "@/lib/dal/scheduled-transactions";
import { listCategoryGroups } from "@/lib/dal/categories";
import { listAccounts } from "@/lib/dal/accounts";
import { ScheduledList } from "@/components/scheduled/scheduled-list";

const ScheduledPage = async () => {
  await autoEnterDue();

  const [upcoming, groups, accounts] = await Promise.all([
    listUpcoming(),
    listCategoryGroups(),
    listAccounts(),
  ]);

  const categoryOptions = groups.flatMap((group) =>
    group.categories
      .filter((category) => !category.hidden)
      .map((category) => ({ id: category.id, name: `${group.name}: ${category.name}` })),
  );

  return (
    <ScheduledList upcoming={upcoming} accounts={accounts} categoryOptions={categoryOptions} />
  );
};

export default ScheduledPage;
