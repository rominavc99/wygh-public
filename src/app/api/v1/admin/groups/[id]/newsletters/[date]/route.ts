import { prisma } from "@/lib/prisma";
import { getNewsletterForDate, personalizeGreeting } from "@/lib/newsletter";
import { heroPhotosForGroup, syncHeroPhotos } from "@/lib/hero-photos";
import { handler, json, notFound, requireApiAdmin } from "@/lib/api/http";
import { checkDate } from "@/lib/api/admin";
import { photoUrl } from "@/lib/api/dto";

/**
 * GET /api/v1/admin/groups/<id>/newsletters/<date> — vista previa del
 * boletín (el ya enviado tal cual salió, o cómo saldría), si ya salió, la
 * foto y la frase de portada que le tocan, y las fotos que se pueden elegir.
 */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/groups/[id]/newsletters/[date]">) => {
  const admin = await requireApiAdmin(request);
  const { id, date } = await ctx.params;
  checkDate(date);
  if (!(await prisma.group.count({ where: { id } }))) throw notFound("No existe ese grupo.");
  const [content, recipients, send, photos, pick] = await Promise.all([
    getNewsletterForDate(id, date),
    prisma.user.count({ where: { active: true, groupMemberships: { some: { groupId: id } } } }),
    prisma.newsletterSend.findUnique({ where: { groupId_date: { groupId: id, date } } }),
    syncHeroPhotos().then((all) => heroPhotosForGroup(id, all)),
    prisma.dailyPick.findUnique({ where: { groupId_date: { groupId: id, date } } }),
  ]);
  const preview = personalizeGreeting(content, admin.name, content.greetingTemplate);
  return json({
    groupId: id,
    date,
    sent: content.sent,
    frozen: content.frozen,
    sentAt: content.sentAt?.toISOString() ?? null,
    status: send?.status ?? null,
    error: send?.error ?? null,
    archived: send?.archived ?? false,
    responseCount: content.responseCount,
    recipientCount: content.recipientCount ?? recipients,
    html: preview.html,
    text: preview.text,
    pick: pick ? { heroPhotoId: pick.heroPhotoId, heroPhotoManual: pick.heroPhotoManual, phraseId: pick.phraseId } : null,
    photos: photos.map((p) => ({ id: p.id, url: photoUrl(p.filename), description: p.description, date: p.date, authorName: p.authorName })),
  });
});
