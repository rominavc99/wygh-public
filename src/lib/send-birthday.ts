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
 * Envía la edición del grupo del boletín de cumpleaños de `userId` para
 * `date` a los miembros activos del grupo (incluida la persona que cumple
 * años). Idempotente por (persona, grupo, fecha) salvo `force` (botón
 * "Reenviar" de /admin/cumpleanos).
 */
export async function sendBirthdayNewsletter(
  userId: string,
  groupId: string,
  date: string,
  options?: { force?: boolean }
): Promise<BirthdaySendResult> {
  const where = { userId_groupId_date: { userId, groupId, date } };
  const existing = await prisma.birthdayNewsletter.findUnique({ where });
  if (existing?.sentAt && !options?.force) {
    return { status: "already_sent", recipientCount: existing.recipientCount, momentCount: existing.momentCount };
  }

  const [content, settings, group] = await Promise.all([
    buildBirthdayNewsletter(userId, groupId, date),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
  ]);

  const { recipients, failures } = await deliverToActiveUsers({
    content,
    subject: `${group.name} — 🎂 Feliz cumpleaños, ${content.celebrantName}`,
    greetingTemplate: settings.birthdayGreetingTemplate,
    settings,
    groupId,
    notification: {
      kind: "birthday",
      title: `🎂 Boletín de cumpleaños de ${content.celebrantName}`,
      url: `/boletines?date=${date}&cumple=${userId}&grupo=${groupId}`,
      text: `Hoy celebramos a ${content.celebrantName} 🎉 Toca para ver su boletín.`,
    },
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
    where,
    create: { userId, groupId, date, ...data },
    update: data,
  });

  return { status, recipientCount: recipients.length, momentCount: content.moments.length, error: error ?? undefined };
}

/** Grupos no suspendidos de `userId`: a cada uno le sale su edición del boletín de cumpleaños. */
export async function birthdayGroupsOf(userId: string) {
  return prisma.group.findMany({
    where: { suspended: false, members: { some: { userId } } },
    orderBy: { name: "asc" },
  });
}

/** Usuarios activos que cumplen años en `date` (el 29 de febrero cuenta el 28 en años no bisiestos). */
export async function birthdayPeopleOn(date: string) {
  const users = await prisma.user.findMany({ where: { active: true, birthday: { not: null } }, orderBy: { name: "asc" } });
  return users.filter((u) => u.birthday && isBirthdayOn(u.birthday, date));
}
