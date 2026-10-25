import { missionTracking } from "@/lib/mission-tracking";
import { handler, json, requireApiAdmin } from "@/lib/api/http";
import { missionDto, userRefDto } from "@/lib/api/dto";

/**
 * GET /api/v1/admin/missions?estado=todas|activas|concluidas|cumplidas|incumplidas|canceladas|rechazadas
 * &usuario=<id>&desde=YYYY-MM-DD&hasta=YYYY-MM-DD — seguimiento de misiones (lo mismo que la pestaña
 * Seguimiento de /admin/misiones). Sin fechas: los últimos 14 días. `usuario` = quien la hizo o para quien era.
 */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const q = new URL(request.url).searchParams;
  const t = await missionTracking({
    estado: q.get("estado") ?? undefined,
    usuario: q.get("usuario") ?? undefined,
    desde: q.get("desde") ?? undefined,
    hasta: q.get("hasta") ?? undefined,
  });
  return json({
    filters: { estado: t.estado, usuario: t.usuario || null, desde: t.desde, hasta: t.hasta },
    sendTime: t.sendTime,
    summary: {
      activeNow: t.activeNow.length,
      openOffers: t.openOffers,
      completed: t.done,
      failed: t.failed,
      cancelled: t.cancelled,
      rejected: t.period.filter((a) => a.status === "REJECTED").length,
      completionRate: t.closed ? t.done / t.closed : null,
    },
    activeByUser: [...t.activeByUser.values()].map((rows) => ({
      user: userRefDto(rows[0].user),
      strikes: rows[0].user.missionStrikes,
      missions: rows.map((m) => missionDto(m)),
    })),
    perUser: t.perUser.map((r) => ({
      user: userRefDto(r.user),
      accepted: r.accepted,
      active: r.active,
      completed: r.done,
      failed: r.failed,
      cancelled: r.cancelled,
      rejected: r.rejected,
      doneForThem: r.forThem,
      strikes: r.user.missionStrikes,
      bannedUntil: r.banned ? r.user.missionBanUntil!.toISOString() : null,
      optOut: r.user.missionOptOut,
    })),
    perDay: t.perDay.map((d) => ({ date: d.date, active: d.active, completed: d.done, failed: d.failed, cancelled: d.cancelled, rejected: d.rejected })),
    missions: t.detail.slice(0, 150).map((m) => ({ ...missionDto(m), responseDate: m.response?.date ?? null })),
  });
});
