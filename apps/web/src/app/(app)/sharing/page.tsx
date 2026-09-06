import type { Metadata } from "next";
import { requireBudget } from "@/lib/dal/budget";
import { listMembers, listPendingInvites } from "@/lib/dal/sharing";
import { SharingView } from "@/components/sharing/sharing-view";

export const metadata: Metadata = { title: "Sharing" };

const SharingPage = async () => {
  const { role: myRole, userId: myUserId } = await requireBudget();
  const isOwner = myRole === "owner";

  const [members, invites] = await Promise.all([
    listMembers(),
    isOwner ? listPendingInvites() : Promise.resolve([]),
  ]);

  return <SharingView members={members} invites={invites} isOwner={isOwner} myUserId={myUserId} />;
};

export default SharingPage;
