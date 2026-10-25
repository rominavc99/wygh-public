import { prisma } from "@/lib/prisma";
import { profileVisibility } from "@/lib/profile";
import { badRequest, handler, json, notFound, requireApiUser } from "@/lib/api/http";
import { missionDto, responseDto } from "@/lib/api/dto";

/**
 * GET /api/v1/users/<id>/history?type=day|home|missions&limit=30&before=YYYY-MM-DD
 * — historial del perfil, del más reciente al más viejo. Para seguir,
 * manda `before` = `nextBefore` de la página anterior (null = no hay más).
 * type=missions trae `done` (las que cumplió) y `forThem` (las que le hicieron).
 */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/users/[id]/history">) => {
  const user = await requireApiUser(request);
  const { id: raw } = await ctx.params;
  const id = raw === "me" ? user.id : raw;
  const visibility = (await prisma.user.count({ where: { id } })) ? await profileVisibility(id, user) : null;
  if (!visibility) throw notFound("No encontramos ese perfil.");

  const params = new URL(request.url).searchParams;
  const type = params.get("type") ?? "day";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 30, 1), 100);
  const before = params.get("before");
  if (before && !/^\d{4}-\d{2}-\d{2}$/.test(before)) throw badRequest('"before" tiene que ser "YYYY-MM-DD".');
  const dateFilter = before ? { date: { lt: before } } : {};

  if (type === "missions") {
    const include = { mission: true, user: true, target: true } as const;
    const [done, forThem] = await Promise.all([
      prisma.missionAssignment.findMany({
        where: { userId: id, status: "COMPLETED", response: visibility.own, ...dateFilter },
        include,
        orderBy: { date: "desc" },
        take: limit + 1,
      }),
      prisma.missionAssignment.findMany({
        where: { targetId: id, status: "COMPLETED", response: visibility.shared, ...dateFilter },
        include,
        orderBy: { date: "desc" },
        take: limit + 1,
      }),
    ]);
    const more = done.length > limit || forThem.length > limit;
    const shown = [...done.slice(0, limit), ...forThem.slice(0, limit)];
    return json({
      done: done.slice(0, limit).map((m) => missionDto(m)),
      forThem: forThem.slice(0, limit).map((m) => missionDto(m)),
      nextBefore: more ? shown.map((m) => m.date).sort()[0] : null,
    });
  }

  if (type !== "day" && type !== "home") throw badRequest('"type" tiene que ser day, home o missions.');
  const rows = await prisma.response.findMany({
    where: { ...visibility.own, format: type === "day" ? "DAY" : "HOME", ...dateFilter },
    include: { user: true },
    orderBy: { date: "desc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return json({
    responses: page.map((r) => responseDto(r)),
    nextBefore: rows.length > limit ? page[page.length - 1].date : null,
  });
});
