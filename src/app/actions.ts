"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { todayLocalDate } from "@/lib/date";
import { parseResponseFormData } from "@/lib/response-schema";
import {
  photoFromFormData,
  validatePhoto,
  saveResponsePhoto,
  deleteResponsePhotoAndHeroRow,
  upsertHeroPhotoForResponse,
} from "@/lib/response-photos";
import { upsertPhraseForResponse, deletePhraseForResponse } from "@/lib/response-phrases";

export type SaveResponseState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> };

export async function saveResponse(
  _prevState: SaveResponseState,
  formData: FormData
): Promise<SaveResponseState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "Tu sesión expiró, vuelve a entrar." };
  }

  if (!rateLimit(`response:${session.user.id}`, 15, 5 * 60 * 1000)) {
    return {
      status: "error",
      message: "Demasiados intentos seguidos. Espera un momento e intenta de nuevo.",
    };
  }

  const date = todayLocalDate();

  const [existing, settings, existingSend] = await Promise.all([
    prisma.response.findUnique({ where: { userId_date: { userId: session.user.id, date } } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.newsletterSend.findUnique({ where: { date } }),
  ]);

  if (settings.lockResponsesAfterSend && existingSend) {
    return {
      status: "error",
      message: "El boletín de hoy ya se envió, así que tu respuesta ya no se puede editar.",
    };
  }

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
    parsed.data.photoFilename = await saveResponsePhoto(session.user.id, date, newPhoto);
  } else if (removePhoto && existing?.photoFilename) {
    await deleteResponsePhotoAndHeroRow(existing.photoFilename);
  }

  if (parsed.data.photoFilename && parsed.data.photoDescription) {
    await upsertHeroPhotoForResponse(
      parsed.data.photoFilename,
      parsed.data.photoDescription,
      date,
      session.user.id
    );
  }

  // Si mandó una frase, se da de alta (o se actualiza la que ya había
  // mandado hoy) en el catálogo de /admin/frases; si la quitó, se borra.
  let phraseId = existing?.phraseId ?? null;
  if (parsed.data.phraseText) {
    phraseId = await upsertPhraseForResponse(phraseId, parsed.data.phraseText, session.user.id, date);
  } else if (phraseId) {
    await deletePhraseForResponse(phraseId);
    phraseId = null;
  }

  await prisma.response.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: { userId: session.user.id, date, ...parsed.data, phraseId },
    update: { ...parsed.data, phraseId },
  });

  revalidatePath("/");
  return { status: "success" };
}
