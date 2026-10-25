import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";

// Qué boletines hay en el archivo de un grupo: los diarios enviados (menos
// los archivados), los días con respuestas extraordinarias y las ediciones
// de cumpleaños. Lo usan /boletines y la API (/api/v1/groups/<id>/newsletters).

export type ArchiveEntry = {
  date: string;
  /** Id de quien cumple años si es una edición de cumpleaños; null si es el diario. */
  cumple: string | null;
  celebrant: string | null;
  /** Del formato anterior ("¿Qué harás al llegar?"), antes del primer resumen del día. */
  legacy: boolean;
};

export async function newsletterArchive(groupId: string) {
  // El primer resumen del día marca el corte: lo de antes es el formato
  // anterior ("¿Qué harás al llegar?") y va en su propia pestaña.
  const firstDay = await prisma.response.findFirst({ where: { format: "DAY" }, orderBy: { date: "asc" }, select: { date: true } });
  const isLegacyDate = (d: string) => !firstDay || d < firstDay.date;

  // Los boletines archivados no deben verse acá — ni en el selector ni
  // entrando directo con su fecha por la URL.
  const [allSends, birthdayEditions, extraordinaryGrantDays] = await Promise.all([
    prisma.newsletterSend.findMany({
      where: { groupId },
      select: { date: true, archived: true },
      orderBy: { date: "desc" },
    }),
    prisma.birthdayNewsletter.findMany({
      where: { sentAt: { not: null }, groupId },
      select: { userId: true, date: true, user: { select: { name: true, username: true } } },
      orderBy: { date: "desc" },
    }),
    // Días con respuestas extraordinarias (ver src/lib/extraordinary.ts):
    // si ese día no salió boletín (justo cuando la app falla), igual se
    // listan para que se vean las respuestas que llegaron después.
    prisma.extraordinaryGrant.findMany({
      where: { usedAt: { not: null } },
      select: { date: true },
      distinct: ["date"],
    }),
  ]);
  // De esos días, solo los que tienen alguna respuesta en este grupo.
  const extraordinaryDays = extraordinaryGrantDays.length
    ? await prisma.response.findMany({
        where: { date: { in: extraordinaryGrantDays.map((d) => d.date) }, groups: { some: { groupId } } },
        select: { date: true },
        distinct: ["date"],
      })
    : [];
  const sendDates = new Set(allSends.map((s) => s.date));
  const sentDates = [
    ...allSends.filter((s) => !s.archived),
    ...extraordinaryDays.filter((d) => !sendDates.has(d.date)),
  ];
  const archivedDates = new Set(allSends.filter((s) => s.archived).map((s) => s.date));

  // Diarios y de cumpleaños en una sola lista, del más reciente al más
  // viejo. El mismo día, el diario (sale en la tarde) va antes que el de
  // cumpleaños (sale en la mañana).
  const allEntries = [
    ...sentDates.map((s) => ({ date: s.date, cumple: null as string | null, celebrant: null as string | null })),
    ...birthdayEditions.map((e) => ({ date: e.date, cumple: e.userId, celebrant: displayName(e.user) })),
  ].sort((a, b) => b.date.localeCompare(a.date) || Number(Boolean(a.cumple)) - Number(Boolean(b.cumple)));
  const entries: ArchiveEntry[] = allEntries.map((e) => ({ ...e, legacy: isLegacyDate(e.date) }));
  return { entries, archivedDates, isLegacyDate };
}
