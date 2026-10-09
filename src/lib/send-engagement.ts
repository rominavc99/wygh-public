import { prisma } from "@/lib/prisma";
import { getMailer, getFromAddress } from "@/lib/mailer";
import { getSiteUrl } from "@/lib/site-url";
import { displayName } from "@/lib/display-name";
import { addDaysLocal } from "@/lib/date";
import { getParticipationStats } from "@/lib/participation-stats";
import { fillNudgeTemplate, inactivityNudgeEmailHtml, inactivityNudgeEmailText } from "@/lib/engagement-email";
import { buildWeeklyReport, type WeeklyReport } from "@/lib/weekly-report";
import { weeklyReportEmailHtml, weeklyReportEmailText } from "@/lib/weekly-report-email";

type SettingsRow = Awaited<ReturnType<typeof prisma.settings.upsert>>;

export function fromAddress(settings: SettingsRow): string {
  return settings.fromName
    ? `${settings.fromName} <${settings.fromEmail || getFromAddress().replace(/.*<|>/g, "")}>`
    : getFromAddress();
}

export async function sendOne(message: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string; cid: string }[];
}) {
  try {
    const result = await getMailer().sendMail(message);
    const rejected = (result.rejected ?? []).concat(result.pending ?? []).filter(Boolean);
    return rejected.length === 0;
  } catch (error) {
    console.error(`[engagement] No se pudo mandar a ${message.to}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Resumen semanal

export type WeeklySummaryResult = {
  status: "sent" | "partial" | "failed" | "already_sent" | "skipped_no_days";
  recipientCount: number;
};

type Recipient = { id: string; email: string; name: string; username: string | null; role: string };

/** Manda el resumen a una persona: la versión de admins si es admin. */
export async function sendWeeklyReportTo(user: Recipient, report: WeeklyReport): Promise<boolean> {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const isAdmin = user.role === "ADMIN";
  const args = { name: displayName(user), userId: user.id, report, siteUrl: getSiteUrl(), isAdmin };
  return sendOne({
    to: user.email,
    from: fromAddress(settings),
    subject: `📊 Resumen semanal${isAdmin ? " (admin)" : ""} — ${settings.newsletterName}`,
    text: weeklyReportEmailText(args),
    html: weeklyReportEmailHtml(args),
  });
}

/**
 * Manda el resumen de los 7 días anteriores a `today`: la versión de
 * admins a los admins y la de miembros al resto. Idempotente por semana
 * (WeeklySummarySend).
 */
export async function sendWeeklySummary(today: string): Promise<WeeklySummaryResult> {
  const weekEnd = addDaysLocal(today, -1);
  const weekStart = addDaysLocal(weekEnd, -6);
  const existing = await prisma.weeklySummarySend.findUnique({ where: { weekStart } });
  if (existing) return { status: "already_sent", recipientCount: existing.recipientCount };

  const report = await buildWeeklyReport(weekEnd);
  if (report.days === 0) {
    await prisma.weeklySummarySend.create({
      data: { weekStart, weekEnd, recipientCount: 0, status: "skipped_no_days" },
    });
    return { status: "skipped_no_days", recipientCount: 0 };
  }

  const recipients = await prisma.user.findMany({ where: { active: true } });
  const results = await Promise.all(recipients.map((user) => sendWeeklyReportTo(user, report)));

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
  let sent = 0;
  let failed = 0;

  for (const user of pending) {
    if (!(await sendNudgeTo(user))) {
      failed++;
      continue;
    }
    sent++;
    await prisma.inactivityNudge.create({ data: { userId: user.id, date: today, missedDays: user.missedStreak } });
  }
  return { sent, failed };
}

/** Manda el correo de inactividad a una persona, con los textos guardados en Ajustes. */
export async function sendNudgeTo(user: { name: string; email: string; missedStreak: number }): Promise<boolean> {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const heading = fillNudgeTemplate(settings.inactivityNudgeSubject, user.name, user.missedStreak);
  const message = fillNudgeTemplate(settings.inactivityNudgeTemplate, user.name, user.missedStreak);
  const args = { name: user.name, heading, message, formUrl: getSiteUrl() };
  return sendOne({
    to: user.email,
    from: fromAddress(settings),
    subject: heading,
    text: inactivityNudgeEmailText(args),
    html: inactivityNudgeEmailHtml(args),
  });
}
