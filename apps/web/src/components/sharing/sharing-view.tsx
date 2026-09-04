"use client";

import { useCallback, useState, useTransition } from "react";
import { Copy, Link2, UserRound } from "lucide-react";

import type { BudgetRole } from "@/lib/dal/budget";
import type { MemberRow, PendingInviteRow } from "@/lib/dal/sharing";
import {
  changeRoleAction,
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/lib/actions/sharing-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const roleLabel: Record<BudgetRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

const roleBadgeVariant: Record<BudgetRole, "default" | "secondary" | "outline"> = {
  owner: "default",
  editor: "secondary",
  viewer: "outline",
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
    (role: string) => {
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
    <div className="flex flex-col gap-1 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
            <UserRound className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {member.name} {isSelf ? <span className="text-muted-foreground">(you)</span> : null}
            </p>
            <p className="text-muted-foreground text-xs">{member.email}</p>
          </div>
        </div>
        {isOwner && !isSelf ? (
          <div className="flex items-center gap-2">
            <Select value={member.role} onValueChange={handleRoleChange} disabled={pending}>
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(roleLabel) as BudgetRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabel[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Badge variant={roleBadgeVariant[member.role]}>{roleLabel[member.role]}</Badge>
        )}
      </div>
      {error ? <span className="text-destructive ml-12 text-xs">{error}</span> : null}
    </div>
  );
};

const InviteForm = () => {
  const [role, setRole] = useState<BudgetRole>("editor");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleCreate = useCallback(() => {
    startTransition(async () => {
      const invite = await createInviteAction(role);
      setLink(`${window.location.origin}/invite/${invite.token}`);
      setCopied(false);
    });
  }, [role]);

  const handleCopy = useCallback(() => {
    if (!link) return;
    void navigator.clipboard.writeText(link);
    setCopied(true);
  }, [link]);
  const handleRoleChange = useCallback((value: string) => setRole(value as BudgetRole), []);

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <p className="text-sm font-semibold">Invite someone</p>
      <div className="flex flex-wrap gap-2">
        <Select value={role} onValueChange={handleRoleChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" disabled={pending} onClick={handleCreate}>
          <Link2 className="size-4" />
          Create invite link
        </Button>
      </div>
      {link ? (
        <div className="bg-muted flex items-center gap-2 rounded-lg p-2">
          <p className="flex-1 truncate text-xs">{link}</p>
          <Button type="button" size="sm" variant="ghost" onClick={handleCopy}>
            <Copy className="size-3.5" />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">Valid for 7 days, single use.</p>
    </div>
  );
};

const PendingInviteRowView = ({ invite }: { readonly invite: PendingInviteRow }) => {
  const [pending, startTransition] = useTransition();
  const handleRevoke = useCallback(() => {
    startTransition(() => revokeInviteAction(invite.id));
  }, [invite.id]);

  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="flex items-center gap-2">
        <Badge variant={roleBadgeVariant[invite.role]}>{roleLabel[invite.role]}</Badge>
        <span className="text-muted-foreground">expires {invite.expiresAt.slice(0, 10)}</span>
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
    <h1 className="text-xl font-semibold">Sharing</h1>

    <section className="rounded-xl border px-4">
      <p className="text-muted-foreground pt-3 text-xs font-medium tracking-wide uppercase">
        Members
      </p>
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
          <section className="rounded-xl border px-4">
            <p className="text-muted-foreground pt-3 text-xs font-medium tracking-wide uppercase">
              Pending invites
            </p>
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
