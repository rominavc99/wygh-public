import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Perfil (/perfil y /perfil/<id>): datos de la persona e historial de sus
// respuestas y misiones. Quien no es la persona solo ve lo que se mandó a
// grupos en común y cuyo boletín ya salió (lo mismo que vería en /boletines).

export type ProfileTab = "resumenes" | "casa" | "misiones";

export function profileTab(value: string | undefined): ProfileTab {
  return value === "casa" || value === "misiones" ? value : "resumenes";
}

export type ProfileVisibility = {
  /** Respuestas de la persona que el viewer puede ver (las suyas, todas). */
  own: Prisma.ResponseWhereInput;
  /** Cualquier respuesta mandada a un grupo en común cuyo boletín ya salió (para las misiones hechas para la persona). */
  shared: Prisma.ResponseWhereInput;
};

/**
 * Qué puede ver `viewer` del perfil de `ownerId`. null si no comparten
 * ningún grupo (y el viewer no es admin): no puede ver su perfil.
 */
export async function profileVisibility(
  ownerId: string,
  viewer: { id: string; role: string }
): Promise<ProfileVisibility | null> {
  const ownerGroups = (await prisma.groupMember.findMany({ where: { userId: ownerId }, select: { groupId: true } })).map(
    (g) => g.groupId
  );
  const isMe = viewer.id === ownerId;
  const groupIds =
    isMe || viewer.role === "ADMIN"
      ? ownerGroups
      : (
          await prisma.groupMember.findMany({
            where: { userId: viewer.id, groupId: { in: ownerGroups } },
            select: { groupId: true },
          })
        ).map((g) => g.groupId);
  if (!isMe && groupIds.length === 0 && viewer.role !== "ADMIN") return null;

  const sends = await prisma.newsletterSend.findMany({
    where: { groupId: { in: groupIds }, archived: false },
    select: { groupId: true, date: true },
  });
  const shared: Prisma.ResponseWhereInput = {
    OR: sends.length
      ? groupIds.map((groupId) => ({
          groups: { some: { groupId } },
          date: { in: sends.filter((s) => s.groupId === groupId).map((s) => s.date) },
        }))
      : [{ id: "__ninguno__" }],
  };
  return { own: isMe ? { userId: ownerId } : { userId: ownerId, ...shared }, shared };
}

/** Racha actual: boletines seguidos (de sus grupos, ya enviados) en los que mandó respuesta, hacia atrás. */
async function currentStreak(userId: string): Promise<number> {
  const [sends, responses] = await Promise.all([
    prisma.newsletterSend.findMany({
      where: { group: { members: { some: { userId } } } },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" },
      take: 400,
    }),
    prisma.response.findMany({ where: { userId }, select: { date: true }, orderBy: { date: "desc" }, take: 400 }),
  ]);
  const answered = new Set(responses.map((r) => r.date));
  let streak = 0;
  for (const s of sends) {
    if (!answered.has(s.date)) break;
    streak++;
  }
  return streak;
}

export async function profileStats(userId: string, filter: Prisma.ResponseWhereInput) {
  const [responses, missionsDone, streak] = await Promise.all([
    prisma.response.count({ where: filter }),
    prisma.missionAssignment.count({ where: { userId, status: "COMPLETED", response: filter } }),
    currentStreak(userId),
  ]);
  return { responses, missionsDone, streak };
}
