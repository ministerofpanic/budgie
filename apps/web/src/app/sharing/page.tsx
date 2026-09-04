import { requireBudget } from "@/lib/dal/budget";
import { getAppShellData } from "@/lib/dal/app-shell";
import { listMembers, listPendingInvites } from "@/lib/dal/sharing";
import { AppHeader } from "@/components/app-header";
import { SharingView } from "@/components/sharing/sharing-view";

const SharingPage = async () => {
  const { role: myRole, userId: myUserId } = await requireBudget();
  const isOwner = myRole === "owner";

  const [members, invites, shell] = await Promise.all([
    listMembers(),
    isOwner ? listPendingInvites() : Promise.resolve([]),
    getAppShellData(),
  ]);

  return (
    <>
      <AppHeader {...shell} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
        <SharingView members={members} invites={invites} isOwner={isOwner} myUserId={myUserId} />
      </main>
    </>
  );
};

export default SharingPage;
