import { prisma } from "@/lib/prisma";
import { addDaysLocal, todayLocalDate } from "@/lib/date";
import type { Prisma } from "@/generated/prisma/client";
import type { MissionStatus } from "@/generated/prisma/enums";

// Datos del seguimiento de misiones del admin (activas por persona, por
// persona, por día y detalle, con filtros). Lo usan la pestaña Seguimiento
// de /admin/misiones y GET /api/v1/admin/missions. Las fechas son las del
// resumen en que se entrega cada misión (MissionAssignment.date).

export type TrackingParams = { estado?: string; usuario?: string; desde?: string; hasta?: string };

export const FILTERS: Record<string, { label: string; statuses: MissionStatus[] }> = {
  todas: { label: "Todas", statuses: ["ACCEPTED", "COMPLETED", "FAILED", "CANCELLED", "REJECTED", "OFFERED"] },
  activas: { label: "Activas", statuses: ["ACCEPTED"] },
  concluidas: { label: "Concluidas", statuses: ["COMPLETED", "FAILED", "CANCELLED"] },
  cumplidas: { label: "Cumplidas", statuses: ["COMPLETED"] },
  incumplidas: { label: "Incumplidas", statuses: ["FAILED"] },
  canceladas: { label: "Canceladas", statuses: ["CANCELLED"] },
  rechazadas: { label: "Rechazadas", statuses: ["REJECTED"] },
};

export const DETAIL_LIMIT = 150;
const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

export function count<T>(rows: T[], test: (row: T) => boolean): number {
  return rows.reduce((n, row) => n + (test(row) ? 1 : 0), 0);
}

export async function missionTracking(params: TrackingParams) {
  const today = todayLocalDate();
  const desde = isDate(params.desde) ? params.desde! : addDaysLocal(today, -13);
  const hasta = isDate(params.hasta) ? params.hasta! : addDaysLocal(today, 1);
  const estado = FILTERS[params.estado ?? ""] ? params.estado! : "todas";
  const usuario = params.usuario ?? "";
  const now = new Date();

  const include = { mission: true, user: true, target: true, response: { select: { date: true } } } as const;
  const inRange: Prisma.MissionAssignmentWhereInput = { date: { gte: desde, lte: hasta } };
  const byUser: Prisma.MissionAssignmentWhereInput = usuario ? { OR: [{ userId: usuario }, { targetId: usuario }] } : {};

  const [users, activeNow, openOffers, period, detail, groups] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    // Lo activo no depende del rango: es todo lo aceptado y sin entregar.
    prisma.missionAssignment.findMany({
      where: { status: "ACCEPTED", ...(usuario ? { userId: usuario } : {}) },
      include,
      orderBy: [{ date: "asc" }, { acceptedAt: "asc" }],
    }),
    prisma.missionAssignment.count({ where: { status: "OFFERED" } }),
    prisma.missionAssignment.findMany({ where: { ...inRange, ...byUser }, select: { userId: true, targetId: true, status: true, date: true } }),
    prisma.missionAssignment.findMany({
      where: { ...inRange, ...byUser, status: { in: FILTERS[estado].statuses } },
      include,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: DETAIL_LIMIT + 1,
    }),
    prisma.group.findMany({ where: { suspended: false }, select: { sendTime: true }, orderBy: { sendTime: "asc" } }),
  ]);
  const sendTime = groups[0]?.sendTime ?? "12:00";

  const done = count(period, (a) => a.status === "COMPLETED");
  const failed = count(period, (a) => a.status === "FAILED");
  const cancelled = count(period, (a) => a.status === "CANCELLED");
  const closed = done + failed + cancelled;

  // Activas agrupadas por quien las tiene.
  const activeByUser = new Map<string, typeof activeNow>();
  for (const a of activeNow) activeByUser.set(a.userId, [...(activeByUser.get(a.userId) ?? []), a]);

  // Tabla por persona: solo quien tuvo algo en el periodo o tiene advertencias/baneo.
  const perUser = users
    .map((u) => {
      const mine = period.filter((a) => a.userId === u.id);
      return {
        user: u,
        accepted: count(mine, (a) => a.status !== "OFFERED" && a.status !== "REJECTED"),
        done: count(mine, (a) => a.status === "COMPLETED"),
        failed: count(mine, (a) => a.status === "FAILED"),
        cancelled: count(mine, (a) => a.status === "CANCELLED"),
        rejected: count(mine, (a) => a.status === "REJECTED"),
        active: activeByUser.get(u.id)?.length ?? 0,
        forThem: count(period, (a) => a.targetId === u.id && a.status === "COMPLETED"),
        banned: Boolean(u.missionBanUntil && u.missionBanUntil > now),
      };
    })
    .filter((r) => r.accepted || r.rejected || r.forThem || r.active || r.user.missionStrikes || r.banned || r.user.missionOptOut);

  // Tabla por día (fecha del resumen en que se entrega).
  const days = [...new Set(period.map((a) => a.date))].sort((a, b) => b.localeCompare(a));
  const perDay = days.map((date) => {
    const rows = period.filter((a) => a.date === date);
    return {
      date,
      active: count(rows, (a) => a.status === "ACCEPTED"),
      done: count(rows, (a) => a.status === "COMPLETED"),
      failed: count(rows, (a) => a.status === "FAILED"),
      cancelled: count(rows, (a) => a.status === "CANCELLED"),
      rejected: count(rows, (a) => a.status === "REJECTED"),
    };
  });

  return { desde, hasta, estado, usuario, users, activeNow, openOffers, period, detail, sendTime, done, failed, cancelled, closed, activeByUser, perUser, perDay };
}
