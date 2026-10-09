import { prisma } from "@/lib/prisma";
import { getMailer, getFromAddress } from "@/lib/mailer";
import { getSiteUrl } from "@/lib/site-url";
import { displayName } from "@/lib/display-name";
import { addDaysLocal } from "@/lib/date";
import { getParticipationStats, type UserStats } from "@/lib/participation-stats";
import {
  fillNudgeTemplate,
  inactivityNudgeEmailHtml,
  inactivityNudgeEmailText,
  weeklySummaryEmailHtml,
  weeklySummaryEmailText,
  type WeeklyHighlight,
  type WeeklySummaryContent,
} from "@/lib/engagement-email";

type SettingsRow = Awaited<ReturnType<typeof prisma.settings.upsert>>;

function fromAddress(settings: SettingsRow): string {
  return settings.fromName
    ? `${settings.fromName} <${settings.fromEmail || getFromAddress().replace(/.*<|>/g, "")}>`
    : getFromAddress();
}

async function sendOne(message: { to: string; from: string; subject: string; text: string; html: string }) {
  try {
    const result = await getMailer().sendMail(message);
    const rejected = (result.rejected ?? []).concat(result.pending ?? []).filter(Boolean);
    return rejected.length === 0;
  } catch (error) {
    console.error(`[engagement] No se pudo mandar a ${message.to}:`, error);
    return false;
  }
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Quién(es) tienen el valor más alto; nadie si el máximo no llega a `min`. */
function leaders(users: UserStats[], value: (u: UserStats) => number, min = 1): { names: string; top: number } | null {
  const top = Math.max(0, ...users.map(value));
  if (top < min) return null;
  const names = users.filter((u) => value(u) === top).map((u) => u.name);
  // Si "empatan" casi todos, el dato no dice nada.
  if (names.length > 3) return null;
  return { names: joinNames(names), top };
}

function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
}

// ---------------------------------------------------------------------------
// Resumen semanal

/** Contenido del resumen de los 7 días que terminan en `weekEnd` (inclusive). */
export async function buildWeeklySummary(weekEnd: string): Promise<WeeklySummaryContent & { weekStart: string; days: number }> {
  const weekStart = addDaysLocal(weekEnd, -6);
  const [stats, settings] = await Promise.all([
    getParticipationStats({ from: weekStart, to: weekEnd }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);

  const users = stats.users.filter((u) => u.eligibleDays > 0);
  const ranking = [...users].sort(
    (a, b) => b.rate! - a.rate! || b.responses - a.responses || a.name.localeCompare(b.name)
  );

  const highlights: WeeklyHighlight[] = [];
  const constant = leaders(users, (u) => (u.eligibleDays === stats.days.length ? u.responses : 0));
  if (constant) highlights.push({ icon: "🏆", label: "Más constante", text: `${constant.names} (${constant.top} de ${stats.days.length} días)` });
  const streak = leaders(users, (u) => u.longestStreak, 2);
  if (streak) highlights.push({ icon: "🔥", label: "Racha más larga", text: `${streak.names} (${streak.top} días seguidos)` });
  const loved = leaders(users, (u) => u.reactionsReceived);
  if (loved) highlights.push({ icon: "❤️", label: "Más reacciones recibidas", text: `${loved.names} (${loved.top})` });
  const chatty = leaders(users, (u) => u.commentsGiven);
  if (chatty) highlights.push({ icon: "💬", label: "Más comentarios", text: `${chatty.names} (${chatty.top})` });
  const photos = leaders(users, (u) => u.photos);
  if (photos) highlights.push({ icon: "📸", label: "Más fotos", text: `${photos.names} (${photos.top})` });
  const timed = users.filter((u) => u.typicalTime).sort((a, b) => a.typicalTime!.localeCompare(b.typicalTime!));
  if (timed.length >= 2) {
    highlights.push({ icon: "🐓", label: "Responde más temprano", text: `${timed[0].name} (como a las ${timed[0].typicalTime})` });
  }

  return {
    weekStart,
    days: stats.days.length,
    newsletterName: settings.newsletterName,
    periodLabel: `del ${longDate(weekStart)} al ${longDate(weekEnd)}`,
    groupResponses: stats.totals.responses,
    groupEligible: stats.totals.eligible,
    ranking,
    highlights,
  };
}

export type WeeklySummaryResult = {
  status: "sent" | "partial" | "failed" | "already_sent" | "skipped_no_days";
  recipientCount: number;
};

/**
 * Manda a todos los activos el resumen de los 7 días anteriores a `today`.
 * Idempotente por semana (WeeklySummarySend).
 */
export async function sendWeeklySummary(today: string): Promise<WeeklySummaryResult> {
  const weekEnd = addDaysLocal(today, -1);
  const weekStart = addDaysLocal(weekEnd, -6);
  const existing = await prisma.weeklySummarySend.findUnique({ where: { weekStart } });
  if (existing) return { status: "already_sent", recipientCount: existing.recipientCount };

  const content = await buildWeeklySummary(weekEnd);
  if (content.days === 0) {
    await prisma.weeklySummarySend.create({
      data: { weekStart, weekEnd, recipientCount: 0, status: "skipped_no_days" },
    });
    return { status: "skipped_no_days", recipientCount: 0 };
  }

  const [recipients, settings] = await Promise.all([
    prisma.user.findMany({ where: { active: true } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);
  const from = fromAddress(settings);
  const siteUrl = getSiteUrl();

  const results = await Promise.all(
    recipients.map((user) => {
      const args = { name: displayName(user), userId: user.id, content, siteUrl };
      return sendOne({
        to: user.email,
        from,
        subject: `📊 Resumen semanal — ${settings.newsletterName}`,
        text: weeklySummaryEmailText(args),
        html: weeklySummaryEmailHtml(args),
      });
    })
  );

  const failures = recipients.filter((_, i) => !results[i]).map((u) => u.email);
  const status = failures.length === 0 ? "sent" : failures.length === recipients.length ? "failed" : "partial";
  await prisma.weeklySummarySend.create({
    data: {
      weekStart,
      weekEnd,
      recipientCount: recipients.length - failures.length,
      status,
      error: failures.length ? `No se pudo mandar a: ${failures.join(", ")}` : null,
    },
  });
  return { status, recipientCount: recipients.length - failures.length };
}

// ---------------------------------------------------------------------------
// Correo de inactividad

/**
 * Quién debe recibir hoy el correo de "llevas N días sin responder": quien
 * cumple al menos `threshold` días y no lo ha recibido en esta racha, o ya
 * lleva otros `threshold` días desde el último (N, 2N, 3N…). Se basa en el
 * historial y no en múltiplos exactos para que, si se activa a media
 * racha o se cambia el número, nadie se quede sin su correo.
 */
export async function pendingInactivityNudges(today: string, threshold: number) {
  const stats = await getParticipationStats({ from: today, to: today });
  const candidates = stats.users.filter((u) => u.missedStreak >= threshold);
  if (candidates.length === 0) return [];

  const nudges = await prisma.inactivityNudge.findMany({
    where: { userId: { in: candidates.map((u) => u.id) } },
    orderBy: { date: "desc" },
  });

  return candidates.filter((u) => {
    const mine = nudges.filter((n) => n.userId === u.id);
    if (mine.some((n) => n.date === today)) return false;
    const last = mine.find((n) => !u.lastResponseDate || n.date > u.lastResponseDate);
    return !last || u.missedStreak - last.missedDays >= threshold;
  });
}

export async function sendInactivityNudges(today: string): Promise<{ sent: number; failed: number }> {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  if (!settings.inactivityNudgeEnabled) return { sent: 0, failed: 0 };

  const pending = await pendingInactivityNudges(today, settings.inactivityNudgeDays);
  const from = fromAddress(settings);
  const formUrl = getSiteUrl();
  let sent = 0;
  let failed = 0;

  for (const user of pending) {
    const heading = fillNudgeTemplate(settings.inactivityNudgeSubject, user.name, user.missedStreak);
    const message = fillNudgeTemplate(settings.inactivityNudgeTemplate, user.name, user.missedStreak);
    const args = { name: user.name, heading, message, formUrl };
    const ok = await sendOne({
      to: user.email,
      from,
      subject: heading,
      text: inactivityNudgeEmailText(args),
      html: inactivityNudgeEmailHtml(args),
    });
    if (!ok) {
      failed++;
      continue;
    }
    sent++;
    await prisma.inactivityNudge.create({ data: { userId: user.id, date: today, missedDays: user.missedStreak } });
  }
  return { sent, failed };
}
