import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { displayName } from "@/lib/display-name";
import { birthdayInYear, localDateOf, oneYearBefore } from "@/lib/date";
import { getParticipationStats } from "@/lib/participation-stats";
import { embedResponsePhotosAsAttachments } from "@/lib/send-newsletter";
import { fromAddress, sendOne } from "@/lib/send-engagement";
import {
  anniversaryEmail,
  onThisDayEmail,
  streakEmail,
  welcomeEmail,
  wrappedEmail,
  type EmailParts,
  type WrappedData,
} from "@/lib/extras-email";

/** Días seguidos respondiendo en los que llega la felicitación. */
export const STREAK_MILESTONES = [7, 30, 50, 100, 200, 365];

type Kind = "streak" | "on-this-day" | "anniversary" | "wrapped" | "welcome";

async function getSettings() {
  return prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/**
 * Manda un correo especial una sola vez por (persona, kind, key): primero
 * aparta la fila en EngagementEmail (única) y, si el envío falla, la
 * suelta para que se pueda reintentar.
 */
async function deliverOnce(
  user: { id: string; email: string },
  kind: Kind,
  key: string,
  parts: EmailParts
): Promise<boolean> {
  try {
    await prisma.engagementEmail.create({ data: { userId: user.id, kind, key } });
  } catch {
    return false; // ya se mandó (o se está mandando)
  }
  const ok = await deliverNow(user, parts);
  if (!ok) await prisma.engagementEmail.deleteMany({ where: { userId: user.id, kind, key } });
  return ok;
}

/** Manda un correo especial sin anotarlo (lo usa también "Enviar ahora" en Ajustes). */
export async function deliverNow(user: { email: string }, parts: EmailParts): Promise<boolean> {
  const settings = await getSettings();
  const { html, attachments } = await embedResponsePhotosAsAttachments(parts.html);
  return sendOne({ to: user.email, from: fromAddress(settings), subject: parts.subject, text: parts.text, html, attachments });
}

// ---------------------------------------------------------------------------
// 🔥 Racha

export async function sendStreakEmails(today: string): Promise<number> {
  const stats = await getParticipationStats({ from: null, to: today });
  const lastClosed = stats.days.at(-1);
  if (!lastClosed) return 0;
  const siteUrl = getSiteUrl();
  let sent = 0;
  for (const u of stats.users) {
    if (!STREAK_MILESTONES.includes(u.currentStreak)) continue;
    const parts = streakEmail({ name: u.name, days: u.currentStreak, siteUrl });
    if (await deliverOnce(u, "streak", `${u.currentStreak}:${lastClosed}`, parts)) sent++;
  }
  return sent;
}

// ---------------------------------------------------------------------------
// 📅 Hace un año

export async function onThisDayParts(responseId: string): Promise<EmailParts> {
  const r = await prisma.response.findUniqueOrThrow({
    where: { id: responseId },
    include: { user: true, _count: { select: { reactions: true, comments: true } } },
  });
  return onThisDayEmail({
    name: displayName(r.user),
    date: r.date,
    response: {
      atHome: r.atHome,
      arrivingLate: r.arrivingLate,
      beforeHomePlan: r.beforeHomePlan,
      stayedHome: r.stayedHome,
      homePlan: r.homePlan,
      awayPlan: r.awayPlan,
      tonightPlan: r.tonightPlan,
      food: r.food,
      goingOut: r.goingOut,
      goingOutWhere: r.goingOutWhere,
      note: r.note,
      photoUrl: r.photoFilename ? `${getSiteUrl()}/${r.photoFilename}` : null,
      photoDescription: r.photoDescription,
    },
    reactions: r._count.reactions,
    comments: r._count.comments,
    siteUrl: getSiteUrl(),
  });
}

export async function sendOnThisDayEmails(today: string): Promise<number> {
  const date = oneYearBefore(today);
  const responses = await prisma.response.findMany({
    where: { date, user: { active: true } },
    include: { user: true },
  });
  let sent = 0;
  for (const r of responses) {
    if (await deliverOnce(r.user, "on-this-day", today, await onThisDayParts(r.id))) sent++;
  }
  return sent;
}

// ---------------------------------------------------------------------------
// 🎂 Aniversario en el grupo

export async function anniversaryParts(userId: string, years: number, today: string): Promise<EmailParts> {
  const [stats, settings] = await Promise.all([getParticipationStats({ from: null, to: today }), getSettings()]);
  const u = stats.users.find((x) => x.id === userId);
  return anniversaryEmail({
    name: u?.name ?? "",
    years,
    newsletterName: settings.newsletterName,
    responses: u?.responses ?? 0,
    longestStreak: u?.longestStreak ?? 0,
    reactionsReceived: u?.reactionsReceived ?? 0,
    siteUrl: getSiteUrl(),
  });
}

export async function sendAnniversaryEmails(today: string): Promise<number> {
  const year = Number(today.slice(0, 4));
  const users = await prisma.user.findMany({ where: { active: true } });
  let sent = 0;
  for (const user of users) {
    const joined = localDateOf(user.createdAt);
    const years = year - Number(joined.slice(0, 4));
    if (years < 1 || birthdayInYear(joined, year) !== today) continue;
    if (await deliverOnce(user, "anniversary", String(year), await anniversaryParts(user.id, years, today))) sent++;
  }
  return sent;
}

// ---------------------------------------------------------------------------
// 🎁 Resumen anual

function mostFrequent<T>(items: T[], key: (item: T) => string): T | null {
  const counts = new Map<string, { item: T; count: number }>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const entry = counts.get(k) ?? { item, count: 0 };
    entry.count++;
    counts.set(k, entry);
  }
  let best: { item: T; count: number } | null = null;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  return best?.item ?? null;
}

const foodKey = (food: string) => food.trim().replace(/[.!¡]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Datos del resumen anual de `year` (hasta `to`, para la vista previa a medio año). */
export async function buildWrapped(year: number, to = `${year}-12-31`): Promise<(WrappedData & { userId: string; email: string })[]> {
  const from = `${year}-01-01`;
  const range = { gte: from, lte: to };
  const [stats, settings, responses, reactions] = await Promise.all([
    getParticipationStats({ from, to }),
    getSettings(),
    prisma.response.findMany({
      where: { date: range },
      select: { id: true, userId: true, date: true, food: true, _count: { select: { reactions: true, comments: true } } },
    }),
    prisma.reaction.findMany({ where: { response: { date: range } }, select: { userId: true, response: { select: { userId: true } } } }),
  ]);

  const names = new Map(stats.users.map((u) => [u.id, u.name]));
  const users = stats.users.filter((u) => u.eligibleDays > 0);
  const mostConstant = [...users]
    .sort((a, b) => b.responses - a.responses || a.name.localeCompare(b.name))
    .slice(0, 3)
    .filter((u) => u.responses > 0)
    .map((u) => u.name);
  const groupRate = stats.totals.eligible ? `${Math.round((stats.totals.responses / stats.totals.eligible) * 100)}%` : "—";

  return users.map((u) => {
    const mine = responses.filter((r) => r.userId === u.id);
    const topFood = mostFrequent(mine, (r) => foodKey(r.food));
    const fanId = mostFrequent(
      reactions.filter((r) => r.response.userId === u.id && r.userId !== u.id),
      (r) => r.userId
    )?.userId;
    const favoriteId = mostFrequent(
      reactions.filter((r) => r.userId === u.id && r.response.userId !== u.id),
      (r) => r.response.userId
    )?.response.userId;
    const best = [...mine]
      .map((r) => ({ date: r.date, score: r._count.reactions + r._count.comments }))
      .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))[0];
    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      year,
      newsletterName: settings.newsletterName,
      responses: u.responses,
      eligibleDays: u.eligibleDays,
      longestStreak: u.longestStreak,
      typicalTime: u.typicalTime,
      topFood: topFood ? topFood.food.trim().replace(/[.!¡]+$/, "") : null,
      reactionsGiven: u.reactionsGiven,
      reactionsReceived: u.reactionsReceived,
      commentsGiven: u.commentsGiven,
      photos: u.photos,
      fan: fanId ? names.get(fanId) ?? null : null,
      favorite: favoriteId ? names.get(favoriteId) ?? null : null,
      bestMoment: best && best.score > 0 ? best : null,
      groupRate,
      groupResponses: stats.totals.responses,
      mostConstant,
    };
  });
}

/** El 1 de enero manda a cada quien su resumen del año anterior. */
export async function sendWrappedEmails(today: string): Promise<number> {
  if (!today.endsWith("-01-01")) return 0;
  const year = Number(today.slice(0, 4)) - 1;
  const siteUrl = getSiteUrl();
  let sent = 0;
  for (const data of await buildWrapped(year)) {
    if (await deliverOnce({ id: data.userId, email: data.email }, "wrapped", String(year), wrappedEmail(data, siteUrl))) sent++;
  }
  return sent;
}

// ---------------------------------------------------------------------------
// 👋 Bienvenida

export async function welcomeParts(name: string): Promise<EmailParts> {
  const settings = await getSettings();
  return welcomeEmail({ name, newsletterName: settings.newsletterName, sendTime: settings.sendTime, siteUrl: getSiteUrl() });
}

/** Se llama al dar de alta a alguien; nunca lanza (el alta no debe fallar por el correo). */
export async function sendWelcomeEmail(userId: string): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.welcomeEmailEnabled) return;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await deliverOnce(user, "welcome", "1", await welcomeParts(displayName(user)));
  } catch (error) {
    console.error("[extras] No se pudo mandar la bienvenida:", error);
  }
}

// ---------------------------------------------------------------------------

/** Lo que corre el worker cada día a `extrasEmailTime`. */
export async function sendDailyExtras(today: string): Promise<Record<string, number>> {
  const settings = await getSettings();
  const result: Record<string, number> = {};
  if (settings.streakEmailEnabled) result.rachas = await sendStreakEmails(today);
  if (settings.onThisDayEnabled) result["hace un año"] = await sendOnThisDayEmails(today);
  if (settings.anniversaryEnabled) result.aniversarios = await sendAnniversaryEmails(today);
  if (settings.wrappedEnabled) result["resumen anual"] = await sendWrappedEmails(today);
  return result;
}
