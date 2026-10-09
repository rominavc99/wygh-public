import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { localDateOf, weekdayOf } from "@/lib/date";

/**
 * Métricas de participación para el dashboard de /admin/estadisticas, el
 * resumen semanal y el correo de inactividad.
 *
 * "Día cerrado" = un día con boletín enviado (fila en NewsletterSend): son
 * los días en que se esperaba respuesta. Así el día de hoy no cuenta hasta
 * que sale el boletín, y si un día no hubo boletín nadie lo "debe". A cada
 * persona solo le cuentan los días cerrados desde que la dieron de alta.
 */

export type UserStats = {
  id: string;
  name: string;
  email: string;
  joined: string;
  /** Días cerrados del periodo que le tocaban (desde su alta). */
  eligibleDays: number;
  responses: number;
  /** responses / eligibleDays, o null si no le tocaba ningún día. */
  rate: number | null;
  /** Días cerrados seguidos sin responder hasta hoy (no depende del periodo). */
  missedStreak: number;
  lastResponseDate: string | null;
  /** Días cerrados seguidos respondiendo, contando hacia atrás desde el último del periodo. */
  currentStreak: number;
  longestStreak: number;
  /** Hora típica (mediana) a la que manda su respuesta, "HH:MM". */
  typicalTime: string | null;
  reactionsGiven: number;
  reactionsReceived: number;
  commentsGiven: number;
  commentsReceived: number;
  photos: number;
};

export type DayStats = { date: string; responded: number; eligible: number };
export type WeekdayStats = { weekday: number; responded: number; eligible: number };

export type ParticipationStats = {
  /** Días cerrados del periodo, en orden. */
  days: string[];
  users: UserStats[];
  daily: DayStats[];
  weekdays: WeekdayStats[];
  totals: {
    responses: number;
    eligible: number;
    reactions: number;
    comments: number;
    photos: number;
    /** Días cerrados en que respondió todo el que le tocaba. */
    perfectDays: number;
    atHome: number;
    goingOut: number;
  };
  /** Comidas que más se repiten (solo las que salen 2+ veces). */
  foods: { label: string; count: number }[];
};

/** Periodo inclusivo en fechas "YYYY-MM-DD"; `from` null = desde el principio. */
export async function getParticipationStats({
  from,
  to,
}: {
  from: string | null;
  to: string;
}): Promise<ParticipationStats> {
  const dateRange = { ...(from ? { gte: from } : {}), lte: to };

  const [users, allSends, lastResponses, responses, reactions, comments] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, username: true, email: true, createdAt: true },
    }),
    prisma.newsletterSend.findMany({ select: { date: true }, orderBy: { date: "asc" } }),
    prisma.response.groupBy({ by: ["userId"], _max: { date: true } }),
    prisma.response.findMany({
      where: { date: dateRange },
      select: {
        userId: true,
        date: true,
        createdAt: true,
        photoFilename: true,
        atHome: true,
        goingOut: true,
        food: true,
      },
    }),
    prisma.reaction.findMany({
      where: { response: { date: dateRange } },
      select: { userId: true, response: { select: { userId: true } } },
    }),
    prisma.comment.findMany({
      where: { response: { date: dateRange } },
      select: { userId: true, response: { select: { userId: true } } },
    }),
  ]);

  const closedDays = allSends.map((s) => s.date);
  const days = closedDays.filter((d) => (!from || d >= from) && d <= to);
  const daySet = new Set(days);
  const lastResponseBy = new Map(lastResponses.map((r) => [r.userId, r._max.date]));

  const respondedBy = new Map<string, Set<string>>();
  const minutesBy = new Map<string, number[]>();
  const photosBy = new Map<string, number>();
  for (const r of responses) {
    // Las respuestas de hoy (antes de que salga el boletín) no son de un
    // día cerrado: no suman a la participación, pero sí a la hora típica.
    if (daySet.has(r.date)) {
      if (!respondedBy.has(r.userId)) respondedBy.set(r.userId, new Set());
      respondedBy.get(r.userId)!.add(r.date);
    }
    const minutes = r.createdAt.getHours() * 60 + r.createdAt.getMinutes();
    minutesBy.set(r.userId, [...(minutesBy.get(r.userId) ?? []), minutes]);
    if (r.photoFilename) photosBy.set(r.userId, (photosBy.get(r.userId) ?? 0) + 1);
  }

  const count = (items: { userId: string; response: { userId: string } }[]) => {
    const given = new Map<string, number>();
    const received = new Map<string, number>();
    for (const item of items) {
      given.set(item.userId, (given.get(item.userId) ?? 0) + 1);
      // Reaccionar o comentar en tu propia respuesta no cuenta como recibido.
      if (item.userId !== item.response.userId) {
        received.set(item.response.userId, (received.get(item.response.userId) ?? 0) + 1);
      }
    }
    return { given, received };
  };
  const reactionCounts = count(reactions);
  const commentCounts = count(comments);

  const userStats: UserStats[] = users.map((user) => {
    const joined = localDateOf(user.createdAt);
    const myDays = days.filter((d) => d >= joined);
    const responded = respondedBy.get(user.id) ?? new Set<string>();

    let longestStreak = 0;
    let run = 0;
    for (const d of myDays) {
      run = responded.has(d) ? run + 1 : 0;
      longestStreak = Math.max(longestStreak, run);
    }
    let currentStreak = 0;
    for (let i = myDays.length - 1; i >= 0 && responded.has(myDays[i]); i--) currentStreak++;

    const lastResponseDate = lastResponseBy.get(user.id) ?? null;
    let missedStreak = 0;
    for (let i = closedDays.length - 1; i >= 0; i--) {
      const d = closedDays[i];
      if (d < joined || (lastResponseDate && d <= lastResponseDate)) break;
      missedStreak++;
    }

    const minutes = (minutesBy.get(user.id) ?? []).sort((a, b) => a - b);
    const median = minutes.length ? minutes[Math.floor((minutes.length - 1) / 2)] : null;

    return {
      id: user.id,
      name: displayName(user),
      email: user.email,
      joined,
      eligibleDays: myDays.length,
      responses: responded.size,
      rate: myDays.length ? responded.size / myDays.length : null,
      missedStreak,
      lastResponseDate,
      currentStreak,
      longestStreak,
      typicalTime:
        median === null
          ? null
          : `${String(Math.floor(median / 60)).padStart(2, "0")}:${String(median % 60).padStart(2, "0")}`,
      reactionsGiven: reactionCounts.given.get(user.id) ?? 0,
      reactionsReceived: reactionCounts.received.get(user.id) ?? 0,
      commentsGiven: commentCounts.given.get(user.id) ?? 0,
      commentsReceived: commentCounts.received.get(user.id) ?? 0,
      photos: photosBy.get(user.id) ?? 0,
    };
  });

  const daily: DayStats[] = days.map((date) => {
    const eligibleUsers = userStats.filter((u) => u.joined <= date);
    return {
      date,
      eligible: eligibleUsers.length,
      responded: eligibleUsers.filter((u) => respondedBy.get(u.id)?.has(date)).length,
    };
  });

  const weekdays: WeekdayStats[] = [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const ofDay = daily.filter((d) => weekdayOf(d.date) === weekday);
    return {
      weekday,
      responded: ofDay.reduce((sum, d) => sum + d.responded, 0),
      eligible: ofDay.reduce((sum, d) => sum + d.eligible, 0),
    };
  });

  const activeIds = new Set(users.map((u) => u.id));
  const closedResponses = responses.filter((r) => daySet.has(r.date) && activeIds.has(r.userId));

  const foodCounts = new Map<string, { label: string; count: number }>();
  for (const r of closedResponses) {
    const label = r.food.trim().replace(/[.!¡]+$/, "");
    const key = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (!key) continue;
    const entry = foodCounts.get(key) ?? { label, count: 0 };
    entry.count++;
    foodCounts.set(key, entry);
  }

  return {
    days,
    users: userStats,
    daily,
    weekdays,
    totals: {
      responses: closedResponses.length,
      eligible: daily.reduce((sum, d) => sum + d.eligible, 0),
      reactions: reactions.length,
      comments: comments.length,
      photos: closedResponses.filter((r) => r.photoFilename).length,
      perfectDays: daily.filter((d) => d.eligible > 0 && d.responded === d.eligible).length,
      atHome: closedResponses.filter((r) => r.atHome).length,
      goingOut: closedResponses.filter((r) => r.goingOut).length,
    },
    foods: [...foodCounts.values()]
      .filter((f) => f.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}
