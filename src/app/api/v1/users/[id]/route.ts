import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { lastVisits } from "@/lib/last-seen";
import { eligibleTargets } from "@/lib/missions";
import { profileStats, profileVisibility } from "@/lib/profile";
import { handler, json, notFound, requireApiUser } from "@/lib/api/http";

/**
 * GET /api/v1/users/<id> — encabezado del perfil (también "me" como id).
 * Quien no es la persona solo cuenta lo que se mandó a grupos en común y
 * ya salió; 404 si no comparten grupo.
 */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/users/[id]">) => {
  const user = await requireApiUser(request);
  const { id: raw } = await ctx.params;
  const id = raw === "me" ? user.id : raw;
  const owner = await prisma.user.findUnique({ where: { id } });
  const visibility = owner ? await profileVisibility(id, user) : null;
  if (!owner || !visibility) throw notFound("No encontramos ese perfil.");

  const isMe = id === user.id;
  const [stats, visits, latest, targets] = await Promise.all([
    profileStats(id, visibility.own),
    isMe ? null : lastVisits([id]),
    prisma.response.findFirst({ where: { ...visibility.own, format: "DAY", mood: { not: null } }, orderBy: { date: "desc" }, select: { mood: true } }),
    isMe ? [] : eligibleTargets(user.id, "chosen"),
  ]);

  return json({
    id,
    name: displayName(owner),
    realName: owner.username ? owner.name : null,
    isMe,
    lastSeenAt: visits?.get(id)?.toISOString() ?? null,
    mood: latest?.mood ?? null,
    /** Solo mes y día ("MM-DD"): el año no se comparte. */
    birthday: owner.birthday ? owner.birthday.slice(5) : null,
    stats,
    canRequestMission: targets.some((t) => t.id === id),
  });
});
