"use client";

import { useCallback, useState, useTransition } from "react";

import type { BudgetRole } from "@/lib/dal/budget";
import type { MemberRow, PendingInviteRow } from "@/lib/dal/sharing";
import {
  changeRoleAction,
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/lib/actions/sharing-actions";
import { Button } from "@/components/ui/button";

const roleLabel: Record<BudgetRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

const MemberRowView = ({
  member,
  isOwner,
  myUserId,
}: {
  readonly member: MemberRow;
  readonly isOwner: boolean;
  readonly myUserId: string;
}) => {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isSelf = member.userId === myUserId;

  const handleRoleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const role = event.target.value;
      startTransition(async () => {
        try {
          await changeRoleAction(member.id, role);
          setError(null);
        } catch {
          setError("Could not change role");
        }
      });
    },
    [member.id],
  );

  const handleRemove = useCallback(() => {
    startTransition(async () => {
      try {
        await removeMemberAction(member.id);
        setError(null);
      } catch {
        setError("Could not remove member");
      }
    });
  }, [member.id]);

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {member.name} {isSelf ? "(you)" : ""}
          </p>
          <p className="text-muted-foreground text-xs">{member.email}</p>
        </div>
        {isOwner && !isSelf ? (
          <div className="flex items-center gap-2">
            <select
              className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
              value={member.role}
              disabled={pending}
              onChange={handleRoleChange}
            >
              {(Object.keys(roleLabel) as BudgetRole[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabel[role]}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">{roleLabel[member.role]}</span>
        )}
      </div>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
};

const InviteForm = () => {
  const [role, setRole] = useState<BudgetRole>("editor");
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleRoleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => setRole(event.target.value as BudgetRole),
    [],
  );

  const handleCreate = useCallback(() => {
    startTransition(async () => {
      const invite = await createInviteAction(role);
      setLink(`${window.location.origin}/invite/${invite.token}`);
    });
  }, [role]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-sm font-semibold">Invite someone</p>
      <div className="flex flex-wrap gap-2">
        <select
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          value={role}
          onChange={handleRoleChange}
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <Button type="button" disabled={pending} onClick={handleCreate}>
          Create invite link
        </Button>
      </div>
      {link ? (
        <p className="text-muted-foreground text-xs break-all">
          {link} <span className="italic">(valid for 7 days, single use)</span>
        </p>
      ) : null}
    </div>
  );
};

const PendingInviteRowView = ({ invite }: { readonly invite: PendingInviteRow }) => {
  const [pending, startTransition] = useTransition();
  const handleRevoke = useCallback(() => {
    startTransition(() => revokeInviteAction(invite.id));
  }, [invite.id]);

  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span>
        {roleLabel[invite.role]} invite · expires {invite.expiresAt.slice(0, 10)}
      </span>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleRevoke}>
        Revoke
      </Button>
    </div>
  );
};

const SharingView = ({
  members,
  invites,
  isOwner,
  myUserId,
}: {
  readonly members: readonly MemberRow[];
  readonly invites: readonly PendingInviteRow[];
  readonly isOwner: boolean;
  readonly myUserId: string;
}) => (
  <>
    <h1 className="text-lg font-semibold">Sharing</h1>

    <section className="rounded-lg border px-4">
      <p className="text-muted-foreground pt-3 text-xs uppercase">Members</p>
      <div className="flex flex-col divide-y">
        {members.map((member) => (
          <MemberRowView key={member.id} member={member} isOwner={isOwner} myUserId={myUserId} />
        ))}
      </div>
    </section>

    {isOwner ? (
      <>
        <InviteForm />
        {invites.length > 0 ? (
          <section className="rounded-lg border px-4">
            <p className="text-muted-foreground pt-3 text-xs uppercase">Pending invites</p>
            <div className="flex flex-col divide-y">
              {invites.map((invite) => (
                <PendingInviteRowView key={invite.id} invite={invite} />
              ))}
            </div>
          </section>
        ) : null}
      </>
    ) : null}
  </>
);

export { SharingView };
