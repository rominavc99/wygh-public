import { prisma } from "@/lib/prisma";

/**
 * Da de alta (o actualiza, si esta respuesta ya había mandado una frase
 * antes) la frase que un usuario contribuyó desde el formulario diario,
 * con su fecha y autor ya puestos, para el catálogo de /admin/frases.
 * Devuelve el id de la fila (para guardarlo en Response.phraseId).
 */
export async function upsertPhraseForResponse(
  existingPhraseId: string | null,
  text: string,
  authorId: string,
  date: string
): Promise<string> {
  if (existingPhraseId) {
    const updated = await prisma.phrase
      .update({ where: { id: existingPhraseId }, data: { text, date, authorId } })
      .catch(() => null);
    if (updated) return updated.id;
  }
  const created = await prisma.phrase.create({ data: { text, date, authorId } });
  return created.id;
}

/** Borra la frase asociada a una respuesta (cuando el usuario la quita). */
export async function deletePhraseForResponse(phraseId: string): Promise<void> {
  await prisma.phrase.deleteMany({ where: { id: phraseId } }).catch(() => {});
}
