import { prisma } from "@/lib/prisma";
import { parseResponseFormData } from "@/lib/response-schema";
import {
  photoFromFormData,
  validatePhoto,
  saveResponsePhoto,
  deleteResponsePhotoAndHeroRow,
  upsertHeroPhotoForResponse,
} from "@/lib/response-photos";
import { upsertPhraseForResponse, deletePhraseForResponse } from "@/lib/response-phrases";
import { ensureResponseGroups } from "@/lib/groups";

export type SaveResponseState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> };

type ExistingRow = Awaited<ReturnType<typeof prisma.response.findUnique>>;

/**
 * Valida y guarda la respuesta de `userId` para `date` (foto, frase y la
 * fila en Response). Lo comparten el formulario diario (saveResponse) y el
 * de respuestas extraordinarias; la sesión, el límite de intentos y si se
 * puede responder ese día los revisa cada Server Action antes de llamarla.
 * No va en un archivo "use server" a propósito: ahí quedaría expuesta como
 * acción y cualquiera podría guardar a nombre de otro.
 */
export async function writeResponse(
  userId: string,
  date: string,
  formData: FormData,
  existing: ExistingRow
): Promise<SaveResponseState> {
  // La foto nueva (si viene) se valida primero pero se escribe a disco hasta
  // que el resto del formulario también pasó la validación — antes se
  // guardaba de entrada y, si después fallaba otro campo, quedaba un archivo
  // huérfano en disco (y la persona tenía que volver a subirla igual).
  const newPhoto = photoFromFormData(formData);
  const removePhoto = formData.get("removePhoto") === "on";

  if (newPhoto) {
    const error = await validatePhoto(newPhoto);
    if (error) {
      return { status: "error", fieldErrors: { photo: error }, message: "Revisa los campos marcados." };
    }
  }

  const keptPhoto = removePhoto ? null : existing?.photoFilename ?? null;
  // Placeholder solo para validar (la descripción es obligatoria si hay
  // foto); el nombre real se asigna al guardar el archivo, más abajo.
  const parsed = parseResponseFormData(formData, { filename: newPhoto ? "pendiente" : keptPhoto });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors, message: "Revisa los campos marcados." };
  }

  if (newPhoto) {
    if (existing?.photoFilename) await deleteResponsePhotoAndHeroRow(existing.photoFilename);
    parsed.data.photoFilename = await saveResponsePhoto(userId, date, newPhoto);
  } else if (removePhoto && existing?.photoFilename) {
    await deleteResponsePhotoAndHeroRow(existing.photoFilename);
  }

  if (parsed.data.photoFilename && parsed.data.photoDescription) {
    await upsertHeroPhotoForResponse(parsed.data.photoFilename, parsed.data.photoDescription, date, userId);
  }

  // Si mandó una frase, se da de alta (o se actualiza la que ya había
  // mandado ese día) en el catálogo de /admin/frases; si la quitó, se borra.
  let phraseId = existing?.phraseId ?? null;
  if (parsed.data.phraseText) {
    phraseId = await upsertPhraseForResponse(phraseId, parsed.data.phraseText, userId, date);
  } else if (phraseId) {
    await deletePhraseForResponse(phraseId);
    phraseId = null;
  }

  const saved = await prisma.response.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...parsed.data, phraseId },
    update: { ...parsed.data, phraseId },
  });
  await ensureResponseGroups(saved.id, userId);

  return { status: "success" };
}
