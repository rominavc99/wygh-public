import { prisma } from "@/lib/prisma";
import { getSentHero } from "@/lib/newsletter";
import { parseMomentsSnapshot, topMoments } from "@/lib/birthday-newsletter";
import { handler, json, notFound, requireApiUser } from "@/lib/api/http";
import { requireGroupAccess } from "@/lib/api/groups";
import { interactionInclude, responseDto, userRefDto } from "@/lib/api/dto";
import { heroDto } from "@/lib/api/newsletter-detail";

/** GET /api/v1/groups/<groupId>/birthdays/<userId>/<date> — edición de cumpleaños ya enviada: portada y top de momentos, con su interacción. */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/groups/[groupId]/birthdays/[userId]/[date]">) => {
  const user = await requireApiUser(request);
  const { groupId, userId, date } = await ctx.params;
  await requireGroupAccess(user, groupId);
  const edition = await prisma.birthdayNewsletter.findUnique({
    where: { userId_groupId_date: { userId, groupId, date } },
    include: { user: true },
  });
  if (!edition?.sentAt) throw notFound("No encontramos ese boletín de cumpleaños.");

  const snapshot = parseMomentsSnapshot(edition.momentsJson);
  const ids = snapshot?.responseIds ?? (await topMoments(userId, groupId, date)).map((m) => m.responseId);
  const found = await prisma.response.findMany({ where: { id: { in: ids }, groups: { some: { groupId } } }, include: interactionInclude(groupId) });
  const moments = ids.flatMap((id) => found.filter((r) => r.id === id));

  return json({
    groupId,
    date,
    celebrant: userRefDto(edition.user),
    title: snapshot?.title ?? "Top 5 momentos del año",
    hero: heroDto(getSentHero(edition)),
    moments: moments.map((r) => responseDto(r, { reactions: r.reactions, comments: r.comments, viewerId: user.id })),
  });
});
