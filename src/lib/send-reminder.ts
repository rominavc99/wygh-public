import { prisma } from "@/lib/prisma";
import { getMailer, getFromAddress } from "@/lib/mailer";
import { reminderEmailHtml, reminderEmailText } from "@/lib/reminder-email";
import { getSiteUrl } from "@/lib/site-url";

export type ReminderResult = {
  status: "sent" | "skipped_disabled" | "skipped_none_pending" | "already_sent";
  recipientCount: number;
};

/**
 * Manda el recordatorio del día indicado a los usuarios activos que
 * todavía no hayan respondido. Idempotente por fecha (una vez al día,
 * como NewsletterSend).
 */
export async function sendReminderIfNeeded(date: string): Promise<ReminderResult> {
  const existing = await prisma.reminderSend.findUnique({ where: { date } });
  if (existing) {
    return { status: "already_sent", recipientCount: existing.recipientCount };
  }

  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  if (!settings.reminderEnabled) {
    return { status: "skipped_disabled", recipientCount: 0 };
  }

  const [activeUsers, responses] = await Promise.all([
    prisma.user.findMany({ where: { active: true } }),
    prisma.response.findMany({ where: { date }, select: { userId: true } }),
  ]);
  const respondedIds = new Set(responses.map((r) => r.userId));
  const pending = activeUsers.filter((u) => !respondedIds.has(u.id));

  if (pending.length === 0) {
    await prisma.reminderSend.create({ data: { date, recipientCount: 0 } });
    return { status: "skipped_none_pending", recipientCount: 0 };
  }

  const transport = getMailer();
  const from = settings.fromName ? `${settings.fromName} <${getFromAddress().replace(/.*<|>/g, "")}>` : getFromAddress();
  const formUrl = getSiteUrl();

  await Promise.allSettled(
    pending.map((user) =>
      transport.sendMail({
        to: user.email,
        from,
        subject: `⏰ Responde antes de las ${settings.sendTime} — ${settings.newsletterName}`,
        text: reminderEmailText({
          name: user.name,
          sendTime: settings.sendTime,
          newsletterName: settings.newsletterName,
          formUrl,
        }),
        html: reminderEmailHtml({
          name: user.name,
          sendTime: settings.sendTime,
          newsletterName: settings.newsletterName,
          formUrl,
        }),
      })
    )
  );

  await prisma.reminderSend.create({ data: { date, recipientCount: pending.length } });
  return { status: "sent", recipientCount: pending.length };
}
