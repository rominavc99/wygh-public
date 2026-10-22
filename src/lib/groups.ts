import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { displayName } from "@/lib/display-name";
import { fromAddress, sendOne } from "@/lib/send-engagement";
import { recordNotification } from "@/lib/notifications";
import { groupInviteEmail } from "@/lib/group-email";

// Grupos (ver el modelo Group en prisma/schema.prisma). Cada grupo tiene su
// propio boletín y está aislado de los demás; una persona puede estar en
// varios y elige a cuáles manda cada respuesta (ResponseGroup).

/** Ids de los grupos no suspendidos de los que `userId` es miembro. */
export async function activeGroupIdsOf(userId: string): Promise<string[]> {
  const rows = await prisma.groupMember.findMany({
    where: { userId, group: { suspended: false } },
    select: { groupId: true },
  });
  return rows.map((r) => r.groupId);
}

/**
 * Mete a alguien recién creado en todos los grupos no suspendidos. Lo usan
 * los seeds; el alta desde /admin/usuarios elige los grupos a mano
 * (addUserToGroups).
 */
export async function addNewUserToDefaultGroups(userId: string): Promise<void> {
  const groups = await prisma.group.findMany({ where: { suspended: false }, select: { id: true } });
  if (groups.length === 0) return;
  await prisma.groupMember.createMany({ data: groups.map((g) => ({ groupId: g.id, userId })) });
}

/**
 * Si la respuesta todavía no va a ningún grupo, la manda a todos los grupos
 * activos de su autor. Las que ya tienen grupos no se tocan.
 */
export async function ensureResponseGroups(responseId: string, userId: string): Promise<void> {
  const existing = await prisma.responseGroup.count({ where: { responseId } });
  if (existing > 0) return;
  const groupIds = await activeGroupIdsOf(userId);
  if (groupIds.length === 0) return;
  await prisma.responseGroup.createMany({ data: groupIds.map((groupId) => ({ responseId, groupId })) });
}

/** Agrega a `userId` a esos grupos (los que ya tenía, o que no existen, se ignoran). */
export async function addUserToGroups(userId: string, groupIds: string[]): Promise<void> {
  if (groupIds.length === 0) return;
  const [groups, current] = await Promise.all([
    prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true } }),
    prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } }),
  ]);
  const have = new Set(current.map((m) => m.groupId));
  const data = groups.filter((g) => !have.has(g.id)).map((g) => ({ groupId: g.id, userId }));
  if (data.length) await prisma.groupMember.createMany({ data });
}

export const JOIN_PATH = "/grupos/unirse";

/** Token nuevo para el enlace de invitación (no adivinable, apto para URL). */
export function newInviteToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export function inviteUrl(token: string): string {
  return `${getSiteUrl()}${JOIN_PATH}/${token}`;
}

/** El token actual del grupo, o uno nuevo si el enlace estaba desactivado. */
export async function ensureInviteToken(groupId: string): Promise<string> {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { inviteToken: true } });
  if (group.inviteToken) return group.inviteToken;
  const token = newInviteToken();
  await prisma.group.update({ where: { id: groupId }, data: { inviteToken: token } });
  return token;
}

export type JoinResult =
  | { status: "joined" | "already"; groupName: string }
  | { status: "invalid" | "suspended" };

/** Une a `userId` al grupo del enlace. Un grupo en pausa no admite gente nueva. */
export async function joinGroupWithToken(userId: string, token: string): Promise<JoinResult> {
  const group = token ? await prisma.group.findUnique({ where: { inviteToken: token } }) : null;
  if (!group) return { status: "invalid" };
  if (group.suspended) return { status: "suspended" };
  const existing = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId } } });
  if (existing) return { status: "already", groupName: group.name };
  await prisma.groupMember.create({ data: { groupId: group.id, userId } });
  return { status: "joined", groupName: group.name };
}

/**
 * Manda el correo "te invitaron a un grupo" con el enlace para unirse, solo
 * a usuarios activos que todavía no son miembros. Devuelve cuántos salieron.
 */
export async function sendGroupInvites(
  groupId: string,
  userIds: string[],
  adminId: string
): Promise<{ total: number; sent: number }> {
  const [group, admin, settings] = await Promise.all([
    prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
    prisma.user.findUnique({ where: { id: adminId } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, active: true, groupMemberships: { none: { groupId } } },
  });
  if (users.length === 0) return { total: 0, sent: 0 };

  const url = inviteUrl(await ensureInviteToken(groupId));
  let sent = 0;
  for (const user of users) {
    try {
      const parts = groupInviteEmail({
        name: displayName(user),
        adminName: admin ? displayName(admin) : "El admin",
        groupName: group.name,
        url,
      });
      const ok = await sendOne({ to: user.email, from: fromAddress(settings), ...parts });
      if (!ok) continue;
      sent++;
      await recordNotification({ userId: user.id, kind: "group-invite", title: parts.subject, text: parts.text, html: parts.html });
    } catch (error) {
      console.error(`[grupos] No se pudo mandar la invitación a ${user.email}:`, error);
    }
  }
  return { total: users.length, sent };
}
