import "server-only";

import { randomBytes, createHash } from "node:crypto";

import { db, schema } from "@budgie/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

import { requireBudget, type BudgetRole } from "@/lib/dal/budget";
import { requireSession } from "@/lib/session";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export type MemberRow = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: BudgetRole;
};

export const listMembers = async (): Promise<readonly MemberRow[]> => {
  const { budgetId } = await requireBudget();
  const rows = await db.query.budgetMember.findMany({
    where: eq(schema.budgetMember.budgetId, budgetId),
    with: { user: true },
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    role: row.role,
  }));
};

export type PendingInviteRow = {
  readonly id: string;
  readonly role: BudgetRole;
  readonly expiresAt: string;
};

export const listPendingInvites = async (): Promise<readonly PendingInviteRow[]> => {
  const { budgetId } = await requireBudget("owner");
  const rows = await db.query.budgetInvite.findMany({
    where: and(
      eq(schema.budgetInvite.budgetId, budgetId),
      isNull(schema.budgetInvite.acceptedAt),
      gt(schema.budgetInvite.expiresAt, new Date()),
    ),
  });
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    expiresAt: row.expiresAt.toISOString(),
  }));
};

const roleSchema = z.enum(["owner", "editor", "viewer"]);

/**
 * Only an owner can create an invite - membership management is the one
 * class of action an editor never gets, even though editors can otherwise
 * mutate every budget figure.
 */
export const createInvite = async (
  rawRole: unknown,
): Promise<{ readonly token: string; readonly expiresAt: string }> => {
  const { budgetId, userId } = await requireBudget("owner");
  const role = roleSchema.parse(rawRole);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db.insert(schema.budgetInvite).values({
    budgetId,
    tokenHash: hashToken(token),
    role,
    expiresAt,
    createdBy: userId,
  });

  return { token, expiresAt: expiresAt.toISOString() };
};

export const revokeInvite = async (rawId: string): Promise<void> => {
  const { budgetId } = await requireBudget("owner");
  const id = z.uuid().parse(rawId);
  await db
    .delete(schema.budgetInvite)
    .where(and(eq(schema.budgetInvite.id, id), eq(schema.budgetInvite.budgetId, budgetId)));
};

export type AcceptInviteError =
  | { readonly kind: "invalid-or-expired" }
  | { readonly kind: "already-a-member" };

/**
 * Accepting an invite makes the signed-in user's session budget the shared
 * one for future requests - the same active-budget cookie a manual switch
 * uses, so a fresh member lands straight on the budget they just joined.
 */
export const acceptInvite = async (
  token: string,
): Promise<
  | { readonly ok: true; readonly budgetId: string }
  | { readonly ok: false; readonly error: AcceptInviteError }
> => {
  const session = await requireSession();
  const invite = await db.query.budgetInvite.findFirst({
    where: eq(schema.budgetInvite.tokenHash, hashToken(token)),
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return { ok: false, error: { kind: "invalid-or-expired" } };
  }

  const existingMembership = await db.query.budgetMember.findFirst({
    where: and(
      eq(schema.budgetMember.budgetId, invite.budgetId),
      eq(schema.budgetMember.userId, session.user.id),
    ),
  });
  if (existingMembership) return { ok: false, error: { kind: "already-a-member" } };

  await db
    .insert(schema.budgetMember)
    .values({ budgetId: invite.budgetId, userId: session.user.id, role: invite.role });
  await db
    .update(schema.budgetInvite)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.budgetInvite.id, invite.id));

  return { ok: true, budgetId: invite.budgetId };
};

/** An owner can promote or demote anyone but themselves, and can never leave
 * a budget with zero owners - both checked here rather than trusted to the UI. */
export const changeRole = async (rawMemberId: string, rawRole: unknown): Promise<void> => {
  const { budgetId, userId } = await requireBudget("owner");
  const memberId = z.uuid().parse(rawMemberId);
  const role = roleSchema.parse(rawRole);

  const member = await db.query.budgetMember.findFirst({
    where: and(eq(schema.budgetMember.id, memberId), eq(schema.budgetMember.budgetId, budgetId)),
  });
  if (!member) throw new Error(`No member ${memberId} in this budget`);
  if (member.userId === userId) throw new Error("Cannot change your own role");

  if (member.role === "owner" && role !== "owner") {
    const owners = await db.query.budgetMember.findMany({
      where: and(eq(schema.budgetMember.budgetId, budgetId), eq(schema.budgetMember.role, "owner")),
    });
    if (owners.length <= 1) throw new Error("A budget must always have an owner");
  }

  await db.update(schema.budgetMember).set({ role }).where(eq(schema.budgetMember.id, memberId));
};

export const removeMember = async (rawMemberId: string): Promise<void> => {
  const { budgetId, userId } = await requireBudget("owner");
  const memberId = z.uuid().parse(rawMemberId);

  const member = await db.query.budgetMember.findFirst({
    where: and(eq(schema.budgetMember.id, memberId), eq(schema.budgetMember.budgetId, budgetId)),
  });
  if (!member) throw new Error(`No member ${memberId} in this budget`);
  if (member.userId === userId)
    throw new Error("Cannot remove yourself - transfer ownership first");

  if (member.role === "owner") {
    const owners = await db.query.budgetMember.findMany({
      where: and(eq(schema.budgetMember.budgetId, budgetId), eq(schema.budgetMember.role, "owner")),
    });
    if (owners.length <= 1) throw new Error("A budget must always have an owner");
  }

  await db.delete(schema.budgetMember).where(eq(schema.budgetMember.id, memberId));
};
