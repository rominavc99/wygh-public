import { prisma } from "@/lib/prisma";
import { getSentHero, missionsForNewsletter, resolveNewsletterHero, type NewsletterHero } from "@/lib/newsletter";
import { addDaysLocal } from "@/lib/date";
import { interactionInclude, missionDto, responseDto } from "@/lib/api/dto";

function heroDto(hero: NewsletterHero | null) {
  if (!hero?.enabled || !hero.title.trim()) return null;
  return {
    title: hero.title,
    paragraph: hero.paragraph || null,
    imageUrl: hero.imageUrl || null,
    imageCaption: hero.imageCaption,
    link: hero.linkUrl ? { url: hero.linkUrl, text: hero.linkText || "Leer más" } : null,
    dailyPhrase: hero.dailyPhrase ? { text: hero.dailyPhrase, author: hero.dailyPhraseAuthor } : null,
  };
}

/** Un boletín diario de un grupo como en /boletines: portada, resúmenes y misiones cumplidas, con reacciones y comentarios de ese grupo. */
export async function newsletterDetail(groupId: string, date: string, legacy: boolean, viewerId: string) {
  const [responses, send, missions, group] = await Promise.all([
    prisma.response.findMany({
      where: { date, groups: { some: { groupId } } },
      include: interactionInclude(groupId),
      orderBy: { user: { name: "asc" } },
    }),
    prisma.newsletterSend.findUnique({ where: { groupId_date: { groupId, date } } }),
    missionsForNewsletter(groupId, date),
    prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
  ]);
  const missionExtras = missions.length
    ? await prisma.missionAssignment.findMany({
        where: { id: { in: missions.map((m) => m.id) } },
        select: {
          id: true,
          reactions: { where: { groupId }, include: { user: true } },
          comments: {
            where: { groupId },
            include: { user: true, reactions: { include: { user: true } }, mentions: { include: { user: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      })
    : [];
  const hero = (send ? getSentHero(send) : null) ?? (await resolveNewsletterHero(date, group));

  return {
    groupId,
    date,
    describedDate: legacy ? date : addDaysLocal(date, -1),
    format: legacy ? "HOME" : "DAY",
    sentAt: send?.sentAt.toISOString() ?? null,
    hero: heroDto(hero),
    responses: responses.map((r) => responseDto(r, { reactions: r.reactions, comments: r.comments, viewerId })),
    missions: missions.map((m) => {
      const extra = missionExtras.find((x) => x.id === m.id);
      return missionDto(m, { reactions: extra?.reactions ?? [], comments: extra?.comments ?? [], viewerId });
    }),
  };
}

export { heroDto };
