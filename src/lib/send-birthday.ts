import { prisma } from "@/lib/prisma";
import { buildBirthdayNewsletter, type BirthdayMomentsSnapshot } from "@/lib/birthday-newsletter";
import { deliverToActiveUsers } from "@/lib/send-newsletter";
import { isBirthdayOn } from "@/lib/date";

export type BirthdaySendResult = {
  status: "sent" | "partial" | "failed" | "already_sent";
  recipientCount: number;
  momentCount: number;
  error?: string;
};

/**
 * Envía el boletín de cumpleaños de `userId` para `date` a todos los
 * usuarios activos (incluida la persona que cumple años). Idempotente por
 * (persona, fecha) salvo `force` (botón "Reenviar" de /admin/cumpleanos).
 */
export async function sendBirthdayNewsletter(
  userId: string,
  date: string,
  options?: { force?: boolean }
): Promise<BirthdaySendResult> {
  const existing = await prisma.birthdayNewsletter.findUnique({ where: { userId_date: { userId, date } } });
  if (existing?.sentAt && !options?.force) {
    return { status: "already_sent", recipientCount: existing.recipientCount, momentCount: existing.momentCount };
  }

  const [content, settings] = await Promise.all([
    buildBirthdayNewsletter(userId, date),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);

  const { recipients, failures } = await deliverToActiveUsers({
    content,
    subject: `${settings.newsletterName} — 🎂 Feliz cumpleaños, ${content.celebrantName}`,
    greetingTemplate: settings.birthdayGreetingTemplate,
    settings,
  });

  const status: BirthdaySendResult["status"] =
    failures.length === 0 ? "sent" : failures.length === recipients.length ? "failed" : "partial";
  const error = failures.length ? `Fallaron: ${failures.join(", ")}` : null;

  const data = {
    status,
    sentAt: new Date(),
    recipientCount: recipients.length,
    momentCount: content.moments.length,
    error,
    contentHtml: content.html,
    contentText: content.text,
    greetingTemplate: settings.birthdayGreetingTemplate,
    heroJson: JSON.stringify(content.hero),
    momentsJson: JSON.stringify({
      title: content.topTitle,
      responseIds: content.moments.map((m) => m.responseId),
    } satisfies BirthdayMomentsSnapshot),
  };
  await prisma.birthdayNewsletter.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  });

  return { status, recipientCount: recipients.length, momentCount: content.moments.length, error: error ?? undefined };
}

/** Usuarios activos que cumplen años en `date` (el 29 de febrero cuenta el 28 en años no bisiestos). */
export async function birthdayPeopleOn(date: string) {
  const users = await prisma.user.findMany({ where: { active: true, birthday: { not: null } }, orderBy: { name: "asc" } });
  return users.filter((u) => u.birthday && isBirthdayOn(u.birthday, date));
}
