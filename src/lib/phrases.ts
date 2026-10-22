import { prisma } from "@/lib/prisma";
import { pickStable } from "@/lib/pick";
import { displayName } from "@/lib/display-name";

export type DailyPhrase = { text: string; authorName: string | null };

type PhraseWithAuthor = {
  id: string;
  text: string;
  date: string | null;
  author: { name: string; username: string | null } | null;
};

function toDailyPhrase(p: PhraseWithAuthor): DailyPhrase {
  return { text: p.text, authorName: p.author ? displayName(p.author) : null };
}

/**
 * Las frases que puede usar la portada de un grupo: las que dio de alta el
 * admin y las que vienen de respuestas mandadas a ese grupo (las de
 * respuestas de otros grupos no se cuelan).
 */
async function phrasesForGroup(groupId: string): Promise<PhraseWithAuthor[]> {
  const [phrases, fromResponses] = await Promise.all([
    prisma.phrase.findMany({ orderBy: { createdAt: "asc" }, include: { author: true } }),
    prisma.response.findMany({
      where: { phraseId: { not: null } },
      select: { phraseId: true, groups: { select: { groupId: true } } },
    }),
  ]);
  const groupsByPhrase = new Map<string, string[]>();
  for (const r of fromResponses) groupsByPhrase.set(r.phraseId!, r.groups.map((g) => g.groupId));
  return phrases.filter((p) => !groupsByPhrase.has(p.id) || groupsByPhrase.get(p.id)!.includes(groupId));
}

/**
 * Frase para el boletín de `date` del grupo `groupId`. Por prioridad:
 * 1. `selectedPhraseId` del grupo, si apunta a una frase que existe (fija
 *    a mano, sin importar el día — ver /admin/frases).
 * 2. La que ya haya quedado fija para este día (resolución automática
 *    previa o re-rolada, ver rerollPhrase) — se respeta aunque después del
 *    primer resuelto aparezca una frase nueva "programada" para hoy (p.
 *    ej. alguien manda una frase desde su respuesta ya entrado el día): la
 *    portada no debe cambiar sola a media tarde.
 * 3. Programada: una frase mandada desde el formulario diario para este
 *    mismo día (ver src/lib/response-phrases.ts) — solo aplica si todavía
 *    no había quedado nada fijo (primera resolución del día).
 * 4. Nueva selección automática entre todas — estable para esa fecha, y
 *    se deja fija en DailyPick para que la vista previa y el envío real
 *    coincidan.
 */
export async function resolveDailyPhrase(
  groupId: string,
  date: string,
  selectedPhraseId: string
): Promise<DailyPhrase | null> {
  if (selectedPhraseId) {
    const selected = await prisma.phrase.findUnique({ where: { id: selectedPhraseId }, include: { author: true } });
    if (selected) return toDailyPhrase(selected);
  }

  const phrases = await phrasesForGroup(groupId);
  if (phrases.length === 0) return null;

  const where = { groupId_date: { groupId, date } };
  const pick = await prisma.dailyPick.findUnique({ where });
  if (pick?.phraseId) {
    const cached = phrases.find((p) => p.id === pick.phraseId);
    if (cached) return toDailyPhrase(cached);
  }

  const scheduled = phrases.find((p) => p.date === date);
  if (scheduled) {
    await prisma.dailyPick.upsert({
      where,
      create: { groupId, date, phraseId: scheduled.id },
      update: { phraseId: scheduled.id },
    });
    return toDailyPhrase(scheduled);
  }

  const resolved = pickStable(phrases, date);
  await prisma.dailyPick.upsert({
    where,
    create: { groupId, date, phraseId: resolved.id },
    update: { phraseId: resolved.id },
  });
  return toDailyPhrase(resolved);
}

/** Re-corre la selección automática de frase para `date` en el grupo (de verdad al azar) y la deja fija. No aplica si el grupo tiene un `selectedPhraseId` fijo: quítalo ahí primero. */
export async function rerollPhrase(groupId: string, date: string): Promise<DailyPhrase | null> {
  const phrases = await phrasesForGroup(groupId);
  if (phrases.length === 0) return null;

  const where = { groupId_date: { groupId, date } };
  const pick = await prisma.dailyPick.findUnique({ where });
  let pool = phrases;
  if (pick?.phraseId && pool.length > 1) {
    const filtered = pool.filter((p) => p.id !== pick.phraseId);
    if (filtered.length > 0) pool = filtered;
  }
  const resolved = pool[Math.floor(Math.random() * pool.length)];

  await prisma.dailyPick.upsert({
    where,
    create: { groupId, date, phraseId: resolved.id },
    update: { phraseId: resolved.id },
  });
  return toDailyPhrase(resolved);
}
