import { newsletterArchive } from "@/lib/newsletter-archive";
import { handler, json, notFound, requireApiUser } from "@/lib/api/http";
import { requireGroupAccess } from "@/lib/api/groups";
import { newsletterDetail } from "@/lib/api/newsletter-detail";

/**
 * GET /api/v1/groups/<groupId>/newsletters/<date> — un boletín diario
 * (fecha "YYYY-MM-DD" del boletín). Solo los que están en el archivo
 * (enviados y no archivados, o días con respuestas extraordinarias).
 */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/groups/[groupId]/newsletters/[date]">) => {
  const user = await requireApiUser(request);
  const { groupId, date } = await ctx.params;
  await requireGroupAccess(user, groupId);
  const { entries } = await newsletterArchive(groupId);
  const entry = entries.find((e) => e.date === date && !e.cumple);
  if (!entry) throw notFound("No hay boletín de ese día en este grupo.");
  return json(await newsletterDetail(groupId, date, entry.legacy, user.id));
});
