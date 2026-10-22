import { prisma } from "@/lib/prisma";

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
 * Grupos a los que entra alguien recién dado de alta. Por ahora todos los
 * que no están suspendidos (con un solo grupo es lo mismo de siempre); el
 * formulario de alta permitirá elegirlos cuando exista la sección Grupos.
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
