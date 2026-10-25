import { prisma } from "@/lib/prisma";
import { getMailer, getFromAddress } from "@/lib/mailer";
import { reminderEmailHtml, reminderEmailText } from "@/lib/reminder-email";
import { getSiteUrl } from "@/lib/site-url";
import { recordNotification } from "@/lib/notifications";

/** Cuántos minutos antes del envío sale cada recordatorio. */
export const REMINDER_OFFSETS = [120, 60, 30] as const;

function remainingLabel(minutes: number): string {
  if (minutes % 60 === 0) return minutes === 60 ? "1 hora" : `${minutes / 60} horas`;
  return `${minutes} minutos`;
}

export type ReminderResult = {
  status: "sent" | "skipped_disabled" | "skipped_none_pending" | "already_sent";
  recipientCount: number;
};

/**
 * Manda el recordatorio del día indicado a los miembros activos del grupo
 * que todavía no hayan respondido (a ningún grupo: quien ya respondió y no
 * eligió este grupo lo hizo a propósito). Idempotente por grupo, fecha y
 * `minutesBefore` (cada uno de REMINDER_OFFSETS sale una vez).
 */
export async function sendReminderIfNeeded(groupId: string, date: string, minutesBefore: number): Promise<ReminderResult> {
  const where = { groupId_date_minutesBefore: { groupId, date, minutesBefore } };
  const existing = await prisma.reminderSend.findUnique({ where });
  if (existing) {
    return { status: "already_sent", recipientCount: existing.recipientCount };
  }

  const [settings, group] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
  ]);
  if (!group.reminderEnabled || group.suspended) {
    return { status: "skipped_disabled", recipientCount: 0 };
  }

  const [activeUsers, responses] = await Promise.all([
    prisma.user.findMany({ where: { active: true, groupMemberships: { some: { groupId } } } }),
    prisma.response.findMany({ where: { date }, select: { userId: true } }),
  ]);
  const respondedIds = new Set(responses.map((r) => r.userId));
  const pending = activeUsers.filter((u) => !respondedIds.has(u.id));

  if (pending.length === 0) {
    await prisma.reminderSend.create({ data: { groupId, date, minutesBefore, recipientCount: 0 } });
    return { status: "skipped_none_pending", recipientCount: 0 };
  }

  const transport = getMailer();
  const from = settings.fromName ? `${settings.fromName} <${getFromAddress().replace(/.*<|>/g, "")}>` : getFromAddress();
  const formUrl = getSiteUrl();

  await Promise.allSettled(
    pending.map(async (user) => {
      const remaining = remainingLabel(minutesBefore);
      const args = { name: user.name, sendTime: group.sendTime, remaining, newsletterName: group.name, formUrl };
      const subject =
        minutesBefore <= 30
          ? `🚨 Últimos ${remaining} para mandar tu resumen — ${group.name}`
          : `⏰ Faltan ${remaining}: manda tu resumen antes de las ${group.sendTime} — ${group.name}`;
      const text = reminderEmailText(args);
      const html = reminderEmailHtml(args);
      await transport.sendMail({ to: user.email, from, subject, text, html });
      await recordNotification({ userId: user.id, kind: "reminder", title: subject, text, html });
    })
  );

  await prisma.reminderSend.create({ data: { groupId, date, minutesBefore, recipientCount: pending.length } });
  return { status: "sent", recipientCount: pending.length };
}
