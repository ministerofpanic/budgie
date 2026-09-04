import { autoEnterDue, listUpcoming } from "@/lib/dal/scheduled-transactions";
import { listCategoryGroups } from "@/lib/dal/categories";
import { getAppShellData } from "@/lib/dal/app-shell";
import { AppHeader } from "@/components/app-header";
import { ScheduledList } from "@/components/scheduled/scheduled-list";

const ScheduledPage = async () => {
  await autoEnterDue();

  const [upcoming, groups, shell] = await Promise.all([
    listUpcoming(),
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
        <ScheduledList
          upcoming={upcoming}
          accounts={shell.accounts}
          categoryOptions={categoryOptions}
        />
      </main>
    </>
  );
};

export default ScheduledPage;
