import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { addDaysLocal, localDateOf, nextBirthdayDate } from "@/lib/date";
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

/** Resumen de los 7 días que terminan en `weekEnd` (inclusive). */
export async function buildWeeklyReport(weekEnd: string): Promise<WeeklyReport> {
  const weekStart = addDaysLocal(weekEnd, -6);
  const [stats, previous, settings, nudges, allUsers, sends] = await Promise.all([
    getParticipationStats({ from: weekStart, to: weekEnd }),
    getParticipationStats({ from: addDaysLocal(weekStart, -7), to: addDaysLocal(weekStart, -1) }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.inactivityNudge.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      include: { user: true },
      orderBy: { date: "asc" },
    }),
    prisma.user.findMany({ select: { name: true, username: true, active: true, createdAt: true, birthday: true } }),
    prisma.newsletterSend.findMany({ where: { date: { gte: weekStart, lte: weekEnd } }, orderBy: { date: "asc" } }),
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
      .map((s) => `Boletín del ${shortDate(s.date)}: ${s.status === "partial" ? "envío parcial" : "falló"}${s.error ? ` (${s.error})` : ""}`),
  ];
  const missingDays = stats.days.length < 7 ? 7 - stats.days.length : 0;
  if (missingDays) sendIssues.push(`${plural(missingDays, "día", "días")} de la semana sin boletín.`);

  return {
    newsletterName: settings.newsletterName,
    periodLabel: `del ${longDate(weekStart)} al ${longDate(weekEnd)}`,
    weekStart,
    weekEnd,
    days: stats.days.length,
    groupResponses: stats.totals.responses,
    groupEligible: stats.totals.eligible,
    ranking,
    highlights,
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
