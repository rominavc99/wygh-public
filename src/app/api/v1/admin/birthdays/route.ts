import { prisma } from "@/lib/prisma";
import { daysBetween, nextBirthdayDate, todayLocalDate } from "@/lib/date";
import { handler, json, requireApiAdmin } from "@/lib/api/http";
import { userRefDto } from "@/lib/api/dto";
import { birthdaySettingsDto } from "@/lib/api/admin-birthdays";

/** GET /api/v1/admin/birthdays — ajustes del boletín de cumpleaños, próximos cumpleaños, quién no ha puesto su fecha y ediciones ya enviadas. */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const today = todayLocalDate();
  const [settings, users, editions] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.birthdayNewsletter.findMany({
      where: { sentAt: { not: null } },
      include: { user: true, group: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  const upcoming = users
    .filter((u) => u.birthday)
    .map((u) => {
      const next = nextBirthdayDate(u.birthday!, today);
      return { user: userRefDto(u), birthday: u.birthday!.slice(5), next, inDays: daysBetween(today, next) };
    })
    .sort((a, b) => a.next.localeCompare(b.next));
  return json({
    settings: birthdaySettingsDto(settings),
    upcoming,
    withoutBirthday: users.filter((u) => !u.birthday).map(userRefDto),
    sent: editions.map((e) => ({
      user: userRefDto(e.user),
      groupId: e.groupId,
      groupName: e.group.name,
      date: e.date,
      sentAt: e.sentAt!.toISOString(),
      status: e.status,
      recipientCount: e.recipientCount,
    })),
  });
});
