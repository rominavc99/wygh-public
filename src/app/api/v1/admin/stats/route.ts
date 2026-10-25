import { getParticipationStats } from "@/lib/participation-stats";
import { addDaysLocal, todayLocalDate } from "@/lib/date";
import { badRequest, handler, json, requireApiAdmin } from "@/lib/api/http";

const isDate = (v: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

/**
 * GET /api/v1/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&groupId= — participación
 * (lo mismo que /admin/estadisticas). Sin fechas: los últimos 30 días; from=all = desde el principio.
 */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const params = new URL(request.url).searchParams;
  const today = todayLocalDate();
  const to = params.get("to") ?? addDaysLocal(today, -1);
  const fromParam = params.get("from");
  const from = fromParam === "all" ? null : fromParam ?? addDaysLocal(to, -29);
  if (!isDate(to) || (from !== null && !isDate(from))) throw badRequest('Las fechas tienen que ser "YYYY-MM-DD".');
  const stats = await getParticipationStats({ from, to, groupId: params.get("groupId") || undefined });
  return json({ from, to, ...stats });
});
