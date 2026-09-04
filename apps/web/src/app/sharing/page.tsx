import { requireBudget } from "@/lib/dal/budget";
import { listMembers, listPendingInvites } from "@/lib/dal/sharing";
import { SharingView } from "@/components/sharing/sharing-view";

const SharingPage = async () => {
  const { role: myRole, userId: myUserId } = await requireBudget();
  const isOwner = myRole === "owner";

  const [members, invites] = await Promise.all([
    listMembers(),
    isOwner ? listPendingInvites() : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <SharingView members={members} invites={invites} isOwner={isOwner} myUserId={myUserId} />
    </main>
  );
};

export default SharingPage;
