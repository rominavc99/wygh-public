import { prisma } from "@/lib/prisma";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session-config";

/** Cada cuánto se vuelve a escribir lastSeenAt de alguien que sigue navegando. */
const SEEN_THROTTLE_MS = 10 * 60 * 1000;

/**
 * Anota que `userId` abrió el sitio. Se llama desde las páginas con sesión
 * (inicio, /boletines, /mis-respuestas, /perfil); solo escribe si la
 * última marca tiene más de 10 minutos, para no escribir en cada clic.
 */
export async function markSeen(userId: string): Promise<void> {
  const now = new Date();
  await prisma.user
    .updateMany({
      where: {
        id: userId,
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(now.getTime() - SEEN_THROTTLE_MS) } }],
      },
      data: { lastSeenAt: now },
    })
    .catch((error) => console.error("[last-seen] No se pudo anotar la visita:", error));
}

/**
 * Última visita al sitio de cada persona. Además de lastSeenAt (que existe
 * desde octubre de 2026), se aprovecha lo que ya había: Auth.js alarga el
 * vencimiento de la sesión como mucho una vez al día cuando alguien entra,
 * así que vencimiento − 90 días ≈ última visita; y responder, reaccionar o
 * comentar también es haber entrado. Se queda con lo más reciente.
 */
export async function lastVisits(userIds: string[]): Promise<Map<string, Date>> {
  const where = { userId: { in: userIds } };
  const [users, sessions, responses, reactions, comments] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, lastSeenAt: true } }),
    prisma.session.groupBy({ by: ["userId"], where, _max: { expires: true } }),
    prisma.response.groupBy({ by: ["userId"], where, _max: { updatedAt: true } }),
    prisma.reaction.groupBy({ by: ["userId"], where, _max: { createdAt: true } }),
    prisma.comment.groupBy({ by: ["userId"], where, _max: { createdAt: true } }),
  ]);

  const result = new Map<string, Date>();
  const consider = (userId: string, date: Date | null | undefined) => {
    if (!date) return;
    // Una sesión recién creada vence en el futuro: su "visita" es hoy, no después.
    const capped = date.getTime() > Date.now() ? new Date() : date;
    const current = result.get(userId);
    if (!current || capped > current) result.set(userId, capped);
  };
  for (const u of users) consider(u.id, u.lastSeenAt);
  for (const s of sessions) {
    if (s._max.expires) consider(s.userId, new Date(s._max.expires.getTime() - SESSION_MAX_AGE_SECONDS * 1000));
  }
  for (const r of responses) consider(r.userId, r._max.updatedAt);
  for (const r of reactions) consider(r.userId, r._max.createdAt);
  for (const c of comments) consider(c.userId, c._max.createdAt);
  return result;
}
