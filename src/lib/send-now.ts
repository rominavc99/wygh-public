import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { getSiteUrl } from "@/lib/site-url";
import { addDaysLocal, birthdayInYear, localDateOf, oneYearBefore } from "@/lib/date";
import { getParticipationStats } from "@/lib/participation-stats";
import { buildWeeklyReport } from "@/lib/weekly-report";
import { sendNudgeTo, sendWeeklyReportTo } from "@/lib/send-engagement";
import { streakEmail, wrappedEmail } from "@/lib/extras-email";
import { anniversaryParts, buildWrapped, deliverNow, onThisDayParts, STREAK_MILESTONES, welcomeParts } from "@/lib/send-extras";

/**
 * "Enviar ahora" de Ajustes: manda un correo en el momento, a quienes les
 * tocaría hoy, sin anotarlo en WeeklySummarySend / InactivityNudge /
 * EngagementEmail — así la programación sigue exactamente igual.
 */

export const MANUAL_EMAIL_KINDS = ["weekly", "nudge", "streak", "on-this-day", "anniversary", "wrapped", "welcome"] as const;
export type ManualEmailKind = (typeof MANUAL_EMAIL_KINDS)[number];

type Job = { name: string; send: () => Promise<boolean> };

async function jobsFor(kind: ManualEmailKind, today: string, userId?: string): Promise<Job[]> {
  switch (kind) {
    case "weekly": {
      const recipients = await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } });
      // El reporte se arma una sola vez, y solo si de verdad se va a mandar.
      let report: ReturnType<typeof buildWeeklyReport> | undefined;
      return recipients.map((user) => ({
        name: displayName(user),
        send: async () => sendWeeklyReportTo(user, await (report ??= buildWeeklyReport(addDaysLocal(today, -1)))),
      }));
    }
    case "nudge": {
      const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
      const stats = await getParticipationStats({ from: today, to: today });
      return stats.users
        .filter((u) => u.missedStreak >= settings.inactivityNudgeDays)
        .map((u) => ({ name: `${u.name} (${u.missedStreak} días)`, send: () => sendNudgeTo(u) }));
    }
    case "streak": {
      // A mano no se espera al número exacto: le llega a quien va en racha
      // de al menos la primera meta, con los días que lleva.
      const stats = await getParticipationStats({ from: null, to: today });
      return stats.users
        .filter((u) => u.currentStreak >= STREAK_MILESTONES[0])
        .map((u) => ({
          name: `${u.name} (${u.currentStreak} días)`,
          send: () => deliverNow(u, streakEmail({ name: u.name, days: u.currentStreak, siteUrl: getSiteUrl() })),
        }));
    }
    case "on-this-day": {
      const responses = await prisma.response.findMany({
        where: { date: oneYearBefore(today), user: { active: true } },
        include: { user: true },
      });
      return responses.map((r) => ({
        name: displayName(r.user),
        send: async () => deliverNow(r.user, await onThisDayParts(r.id)),
      }));
    }
    case "anniversary": {
      const year = Number(today.slice(0, 4));
      const users = await prisma.user.findMany({ where: { active: true } });
      return users
        .map((user) => ({ user, joined: localDateOf(user.createdAt) }))
        .filter(({ joined }) => year > Number(joined.slice(0, 4)) && birthdayInYear(joined, year) === today)
        .map(({ user, joined }) => ({
          name: displayName(user),
          send: async () => deliverNow(user, await anniversaryParts(user.id, year - Number(joined.slice(0, 4)), today)),
        }));
    }
    case "wrapped": {
      // El año en curso hasta ayer (el del 1 de enero cubre el año anterior completo).
      const data = await buildWrapped(Number(today.slice(0, 4)), addDaysLocal(today, -1));
      return data.map((d) => ({
        name: d.name,
        send: () => deliverNow({ email: d.email }, wrappedEmail(d, getSiteUrl(), true)),
      }));
    }
    case "welcome": {
      if (!userId) return [];
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.active) return [];
      return [{ name: displayName(user), send: async () => deliverNow(user, await welcomeParts(displayName(user))) }];
    }
  }
}

/** A quién le llegaría hoy (para mostrarlo junto al botón). */
export async function manualRecipients(kind: Exclude<ManualEmailKind, "welcome">, today: string): Promise<string[]> {
  return (await jobsFor(kind, today)).map((j) => j.name);
}

export async function sendManualEmail(
  kind: ManualEmailKind,
  today: string,
  userId?: string
): Promise<{ total: number; sent: number }> {
  const jobs = await jobsFor(kind, today, userId);
  const results = await Promise.all(jobs.map((j) => j.send()));
  return { total: jobs.length, sent: results.filter(Boolean).length };
}
