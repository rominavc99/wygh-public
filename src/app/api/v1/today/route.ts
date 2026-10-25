import { prisma } from "@/lib/prisma";
import { addDaysLocal, todayLocalDate } from "@/lib/date";
import { openResponseDate, responseGroupOptions, responseLock } from "@/lib/groups";
import { deliverableMissions } from "@/lib/missions";
import { handler, json, requireApiUser } from "@/lib/api/http";
import { photoUrl, responseDto } from "@/lib/api/dto";

/**
 * GET /api/v1/today — el resumen abierto: a qué boletín va (`date`), de qué
 * día habla (`describedDate`), si "hoy" o "ayer" (`dayWord`), cuándo sale,
 * a qué grupos puede ir, si ya se bloqueó, lo que ya mandó y las misiones
 * que puede entregar con él.
 */
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  const date = await openResponseDate(user.id);
  const today = todayLocalDate();
  const describedDate = addDaysLocal(date, -1);

  const [existing, settings, missions, groups] = await Promise.all([
    prisma.response.findUnique({ where: { userId_date: { userId: user.id, date } }, include: { user: true } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    deliverableMissions(user.id, date),
    prisma.group.findMany({
      where: { suspended: false, members: { some: { userId: user.id } } },
      select: { sendTime: true },
      orderBy: { sendTime: "asc" },
    }),
  ]);
  const options = await responseGroupOptions(user.id, date, existing?.id ?? null);
  const { locked, allowedGroupIds } = responseLock(options, Boolean(existing), settings.lockResponsesAfterSend);

  return json({
    date,
    describedDate,
    dayWord: describedDate === today ? "hoy" : "ayer",
    sendTime: groups[0]?.sendTime ?? null,
    sendsToday: date === today,
    noGroups: options.length === 0,
    locked,
    groups: options.map((o) => ({ id: o.id, name: o.name, selected: o.selected, disabled: !allowedGroupIds.includes(o.id), sent: o.sent })),
    response: existing ? responseDto(existing) : null,
    missions: missions.map((m) => ({
      id: m.id,
      text: m.text,
      requiresPhoto: m.requiresPhoto,
      targetName: m.targetName,
      resolutionText: m.resolutionText,
      photoUrl: photoUrl(m.photoFilename),
    })),
  });
});
