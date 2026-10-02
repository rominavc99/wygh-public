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
 * Frase para el boletín de `date`. Por prioridad:
 * 1. `selectedPhraseId` de Ajustes, si apunta a una frase que existe (fija
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
export async function resolveDailyPhrase(date: string, selectedPhraseId: string): Promise<DailyPhrase | null> {
  if (selectedPhraseId) {
    const selected = await prisma.phrase.findUnique({ where: { id: selectedPhraseId }, include: { author: true } });
    if (selected) return toDailyPhrase(selected);
  }

  const phrases = await prisma.phrase.findMany({ orderBy: { createdAt: "asc" }, include: { author: true } });
  if (phrases.length === 0) return null;

  const pick = await prisma.dailyPick.findUnique({ where: { date } });
  if (pick?.phraseId) {
    const cached = phrases.find((p) => p.id === pick.phraseId);
    if (cached) return toDailyPhrase(cached);
  }

  const scheduled = phrases.find((p) => p.date === date);
  if (scheduled) {
    await prisma.dailyPick.upsert({
      where: { date },
      create: { date, phraseId: scheduled.id },
      update: { phraseId: scheduled.id },
    });
    return toDailyPhrase(scheduled);
  }

  const resolved = pickStable(phrases, date);
  await prisma.dailyPick.upsert({
    where: { date },
    create: { date, phraseId: resolved.id },
    update: { phraseId: resolved.id },
  });
  return toDailyPhrase(resolved);
}

/** Re-corre la selección automática de frase para `date` (de verdad al azar) y la deja fija. No aplica si hay un `selectedPhraseId` fijo en Ajustes: quítalo ahí primero. */
export async function rerollPhrase(date: string): Promise<DailyPhrase | null> {
  const phrases = await prisma.phrase.findMany({ orderBy: { createdAt: "asc" }, include: { author: true } });
  if (phrases.length === 0) return null;

  const pick = await prisma.dailyPick.findUnique({ where: { date } });
  let pool = phrases;
  if (pick?.phraseId && pool.length > 1) {
    const filtered = pool.filter((p) => p.id !== pick.phraseId);
    if (filtered.length > 0) pool = filtered;
  }
  const resolved = pool[Math.floor(Math.random() * pool.length)];

  await prisma.dailyPick.upsert({
    where: { date },
    create: { date, phraseId: resolved.id },
    update: { phraseId: resolved.id },
  });
  return toDailyPhrase(resolved);
}
