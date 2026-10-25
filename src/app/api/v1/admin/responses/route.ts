import { prisma } from "@/lib/prisma";
import { pendingNewsletterDate } from "@/lib/groups";
import { badRequest, handler, json, requireApiAdmin } from "@/lib/api/http";
import { responseDto, userRefDto } from "@/lib/api/dto";

/**
 * GET /api/v1/admin/responses?date=YYYY-MM-DD — todas las respuestas de un
 * boletín (de todos los grupos) y quién falta. Sin date: el boletín que todavía no sale.
 */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const date = new URL(request.url).searchParams.get("date") ?? (await pendingNewsletterDate());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('"date" tiene que ser "YYYY-MM-DD".');
  const [responses, active] = await Promise.all([
    prisma.response.findMany({
      where: { date },
      include: { user: true, groups: { include: { group: { select: { id: true, name: true } } } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const answered = new Set(responses.map((r) => r.userId));
  return json({
    date,
    responses: responses.map((r) => ({ ...responseDto(r), groups: r.groups.map((g) => g.group) })),
    missing: active.filter((u) => !answered.has(u.id)).map(userRefDto),
  });
});
