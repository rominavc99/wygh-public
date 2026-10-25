import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { addDaysLocal, describedDate, localDateOf, nextBirthdayDate } from "@/lib/date";
import { getParticipationStats, type DayStats, type UserStats } from "@/lib/participation-stats";

/**
 * Contenido del resumen semanal. Hay dos versiones del correo
 * (src/lib/weekly-report-email.ts): la de miembros usa todo lo de arriba
 * de `admin`, y la de admins además lo de `admin`.
 */

export type TopEntry = { name: string; label: string };
export type TopList = {
  icon: string;
  title: string;
  entries: TopEntry[];
  /** Cuántos más empatan con el último de la lista y no cupieron. */
  tiedMore: number;
  /** Texto cuando la lista queda vacía. */
  empty: string;
};
export type Highlight = { icon: string; label: string; text: string };
export type PersonDays = { name: string; days: number; detail: string };
/** Una "mejor parte" o "peor parte" de un resumen del día. `date` es el día del que habla. */
export type Moment = { name: string; date: string; text: string };

export type WeeklyReport = {
  newsletterName: string;
  periodLabel: string;
  weekStart: string;
  weekEnd: string;
  /** Días con boletín en la semana. */
  days: number;
  groupResponses: number;
  groupEligible: number;
  /** Personas a las que les tocaba algún día, de más a menos participación. */
  ranking: UserStats[];
  highlights: Highlight[];
  /** Lo mejor y lo peor de la semana: de los resúmenes con más reacciones y comentarios en el grupo. */
  moments: { best: Moment[]; worst: Moment[] };
  /** Misiones cumplidas en la semana que salieron en el boletín del grupo. */
  missionsCompleted: number;
  /** Pares [más, menos] de respuestas, reacciones y comentarios. */
  tops: [TopList, TopList][];
  threshold: number;
  missing: PersonDays[];
  absent: PersonDays[];
  admin: {
    previousResponses: number;
    previousEligible: number;
    daily: DayStats[];
    nudges: { name: string; missedDays: number }[];
    newUsers: string[];
    birthdays: { name: string; date: string }[];
    sendIssues: string[];
    deactivateCandidates: PersonDays[];
    inactiveAccounts: number;
  };
};

const TOP_SIZE = 3;
const MOMENTS = 3;
/** Días sin entrar ni responder a partir de los que se sugiere desactivar. */
const DEACTIVATE_AFTER_DAYS = 14;

export function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function topList({
  users,
  icon,
  title,
  value,
  label,
  ascending,
  empty,
}: {
  users: UserStats[];
  icon: string;
  title: string;
  value: (u: UserStats) => number;
  label: (u: UserStats) => string;
  ascending: boolean;
  empty: string;
}): TopList {
  // En los "más" no tiene chiste listar a quien tiene 0.
  const pool = ascending ? users : users.filter((u) => value(u) > 0);
  const sorted = [...pool].sort(
    (a, b) => (ascending ? value(a) - value(b) : value(b) - value(a)) || a.name.localeCompare(b.name)
  );
  const shown = sorted.slice(0, TOP_SIZE);
  const last = shown.at(-1);
  const tiedMore = last ? sorted.slice(TOP_SIZE).filter((u) => value(u) === value(last)).length : 0;
  return { icon, title, entries: shown.map((u) => ({ name: u.name, label: label(u) })), tiedMore, empty };
}

/** Quién(es) tienen el valor más alto, si llega a `min` y no empatan más de 3. */
function leaders(users: UserStats[], value: (u: UserStats) => number, min = 1): { names: string; top: number } | null {
  const top = Math.max(0, ...users.map(value));
  if (top < min) return null;
  const names = users.filter((u) => value(u) === top).map((u) => u.name);
  if (names.length > 3) return null;
  return { names: joinNames(names), top };
}

/** Quién(es) aparecen más veces en `names`, si no empatan más de 3. */
function mostOften(names: string[]): { names: string; top: number } | null {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  if (top === 0) return null;
  const tied = [...counts].filter(([, c]) => c === top).map(([n]) => n).sort((a, b) => a.localeCompare(b));
  if (tied.length > 3) return null;
  return { names: joinNames(tied), top };
}

/**
 * Las "mejores" y "peores partes" de los resúmenes de la semana mandados al
 * grupo, empezando por las que más reacciones y comentarios juntaron ahí.
 */
async function weekMoments(groupId: string, weekStart: string, weekEnd: string) {
  const responses = await prisma.response.findMany({
    where: {
      format: "DAY",
      date: { gte: weekStart, lte: weekEnd },
      groups: { some: { groupId } },
      OR: [{ bestPart: { not: null } }, { worstPart: { not: null } }],
    },
    select: {
      date: true,
      format: true,
      bestPart: true,
      worstPart: true,
      user: { select: { name: true, username: true } },
      _count: { select: { reactions: { where: { groupId } }, comments: { where: { groupId, missionId: null } } } },
    },
  });
  const ranked = [...responses].sort(
    (a, b) => b._count.reactions + b._count.comments - (a._count.reactions + a._count.comments) || b.date.localeCompare(a.date)
  );
  const pick = (field: "bestPart" | "worstPart"): Moment[] =>
    ranked
      .filter((r) => r[field]?.trim())
      .slice(0, MOMENTS)
      .map((r) => ({ name: displayName(r.user), date: describedDate(r), text: r[field]!.trim() }));
  return { best: pick("bestPart"), worst: pick("worstPart") };
}

/**
 * Resumen de los 7 días que terminan en `weekEnd` (inclusive) de un grupo:
 * sus miembros, sus días y lo que pasó ahí.
 */
export async function buildWeeklyReport(weekEnd: string, groupId: string): Promise<WeeklyReport> {
  const weekStart = addDaysLocal(weekEnd, -6);
  const members = { groupMemberships: { some: { groupId } } };
  const [stats, previous, settings, group, nudges, allUsers, sends, moments, missions] = await Promise.all([
    getParticipationStats({ from: weekStart, to: weekEnd, groupId }),
    getParticipationStats({ from: addDaysLocal(weekStart, -7), to: addDaysLocal(weekStart, -1), groupId }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
    prisma.inactivityNudge.findMany({
      where: { date: { gte: weekStart, lte: weekEnd }, user: members },
      include: { user: true },
      orderBy: { date: "asc" },
    }),
    prisma.user.findMany({
      where: members,
      select: { name: true, username: true, active: true, createdAt: true, birthday: true },
    }),
    prisma.newsletterSend.findMany({
      where: { date: { gte: weekStart, lte: weekEnd }, groupId },
      orderBy: { date: "asc" },
      include: { group: { select: { name: true } } },
    }),
    weekMoments(groupId, weekStart, weekEnd),
    // Las mismas que salieron en los boletines del grupo (ver missionsForNewsletter).
    prisma.missionAssignment.findMany({
      where: {
        status: "COMPLETED",
        response: { date: { gte: weekStart, lte: weekEnd }, groups: { some: { groupId } } },
        target: { groupMemberships: { some: { groupId } } },
      },
      select: { user: { select: { name: true, username: true } }, target: { select: { name: true, username: true } } },
    }),
  ]);

  const users = stats.users.filter((u) => u.eligibleDays > 0);
  const ranking = [...users].sort(
    (a, b) => b.rate! - a.rate! || b.responses - a.responses || a.name.localeCompare(b.name)
  );
  const threshold = settings.inactivityNudgeDays;

  const highlights: Highlight[] = [];
  const streak = leaders(users, (u) => u.longestStreak, 2);
  if (streak) highlights.push({ icon: "🔥", label: "Racha más larga", text: `${streak.names} (${streak.top} días seguidos)` });
  const loved = leaders(users, (u) => u.reactionsReceived);
  if (loved) highlights.push({ icon: "❤️", label: "Más reacciones recibidas", text: `${loved.names} (${loved.top})` });
  const photos = leaders(users, (u) => u.photos);
  if (photos) highlights.push({ icon: "📸", label: "Más fotos", text: `${photos.names} (${photos.top})` });
  if (missions.length) {
    highlights.push({ icon: "🎯", label: "Misiones cumplidas", text: plural(missions.length, "misión", "misiones") });
    const doers = mostOften(missions.map((m) => displayName(m.user)));
    if (doers) highlights.push({ icon: "🏹", label: "Cumplió más misiones", text: `${doers.names} (${doers.top})` });
    const targets = mostOften(missions.map((m) => displayName(m.target)));
    if (targets) highlights.push({ icon: "🎁", label: "Le hicieron más misiones", text: `${targets.names} (${targets.top})` });
  }
  const timed = users.filter((u) => u.typicalTime).sort((a, b) => a.typicalTime!.localeCompare(b.typicalTime!));
  if (timed.length >= 2) {
    highlights.push({ icon: "🐓", label: "Responde más temprano", text: `${timed[0].name} (como a las ${timed[0].typicalTime})` });
  }

  const responses = (u: UserStats) => `${u.responses} de ${u.eligibleDays} días`;
  const tops: [TopList, TopList][] = [
    [
      topList({ users, icon: "🏆", title: "Responden más", value: (u) => u.responses, label: responses, ascending: false, empty: "Nadie respondió esta semana." }),
      topList({ users, icon: "🥪", title: "Responden menos", value: (u) => u.responses, label: responses, ascending: true, empty: "—" }),
    ],
    [
      topList({ users, icon: "❤️", title: "Reaccionan más", value: (u) => u.reactionsGiven, label: (u) => plural(u.reactionsGiven, "reacción", "reacciones"), ascending: false, empty: "Nadie reaccionó esta semana." }),
      topList({ users, icon: "🧊", title: "Reaccionan menos", value: (u) => u.reactionsGiven, label: (u) => plural(u.reactionsGiven, "reacción", "reacciones"), ascending: true, empty: "—" }),
    ],
    [
      topList({ users, icon: "💬", title: "Comentan más", value: (u) => u.commentsGiven, label: (u) => plural(u.commentsGiven, "comentario", "comentarios"), ascending: false, empty: "Nadie comentó esta semana." }),
      topList({ users, icon: "🤐", title: "Comentan menos", value: (u) => u.commentsGiven, label: (u) => plural(u.commentsGiven, "comentario", "comentarios"), ascending: true, empty: "—" }),
    ],
  ];

  const missing = stats.users
    .filter((u) => u.missedStreak >= threshold)
    .sort((a, b) => b.missedStreak - a.missedStreak || a.name.localeCompare(b.name))
    .map((u) => ({
      name: u.name,
      days: u.missedStreak,
      detail: u.lastResponseDate ? `última respuesta el ${shortDate(u.lastResponseDate)}` : "nunca ha respondido",
    }));
  const absent = stats.users
    .filter((u) => u.daysSinceVisit >= threshold)
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit || a.name.localeCompare(b.name))
    .map((u) => ({
      name: u.name,
      days: u.daysSinceVisit,
      detail: u.lastVisitDate ? `última visita el ${shortDate(u.lastVisitDate)}` : "sin visitas registradas",
    }));

  const today = addDaysLocal(weekEnd, 1);
  const activeUsers = allUsers.filter((u) => u.active);
  const birthdays = activeUsers
    .filter((u) => u.birthday)
    .map((u) => ({ name: displayName(u), date: nextBirthdayDate(u.birthday!, today) }))
    .filter((b) => b.date <= addDaysLocal(today, 6))
    .sort((a, b) => a.date.localeCompare(b.date));

  const sendIssues = [
    ...sends
      .filter((s) => s.status !== "sent")
      .map((s) => `Boletín de ${s.group.name} del ${shortDate(s.date)}: ${s.status === "partial" ? "envío parcial" : "falló"}${s.error ? ` (${s.error})` : ""}`),
  ];
  const missingDays = stats.days.length < 7 ? 7 - stats.days.length : 0;
  if (missingDays) sendIssues.push(`${plural(missingDays, "día", "días")} de la semana sin boletín.`);

  return {
    newsletterName: group.name,
    periodLabel: `del ${longDate(weekStart)} al ${longDate(weekEnd)}`,
    weekStart,
    weekEnd,
    days: stats.days.length,
    groupResponses: stats.totals.responses,
    groupEligible: stats.totals.eligible,
    ranking,
    highlights,
    moments,
    missionsCompleted: missions.length,
    tops,
    threshold,
    missing,
    absent,
    admin: {
      previousResponses: previous.totals.responses,
      previousEligible: previous.totals.eligible,
      daily: stats.daily,
      nudges: nudges.map((n) => ({ name: displayName(n.user), missedDays: n.missedDays })),
      newUsers: activeUsers
        .filter((u) => {
          const joined = localDateOf(u.createdAt);
          return joined >= weekStart && joined <= weekEnd;
        })
        .map((u) => displayName(u)),
      birthdays,
      sendIssues,
      deactivateCandidates: stats.users
        .filter((u) => u.daysSinceVisit >= DEACTIVATE_AFTER_DAYS && u.missedStreak >= DEACTIVATE_AFTER_DAYS)
        .map((u) => ({ name: u.name, days: u.daysSinceVisit, detail: `${u.missedStreak} días sin responder` })),
      inactiveAccounts: allUsers.length - activeUsers.length,
    },
  };
}
