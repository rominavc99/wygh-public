"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { todayLocalDate } from "@/lib/date";
import { writeResponse, type SaveResponseState } from "@/lib/save-response";
import { responseGroupOptions, responseLock } from "@/lib/groups";

export type { SaveResponseState };

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

  const [existing, settings] = await Promise.all([
    prisma.response.findUnique({ where: { userId_date: { userId: session.user.id, date } } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);
  const options = await responseGroupOptions(session.user.id, date, existing?.id ?? null);
  if (options.length === 0) {
    return { status: "error", message: "Todavía no estás en ningún grupo, así que no hay a dónde mandar tu respuesta." };
  }

  const { locked, allowedGroupIds } = responseLock(options, Boolean(existing), settings.lockResponsesAfterSend);
  if (locked) {
    return {
      status: "error",
      message: existing
        ? "El boletín de hoy ya se envió, así que tu respuesta ya no se puede editar."
        : "Los boletines de hoy ya se enviaron. Ya no puedes responder por hoy.",
    };
  }

  const result = await writeResponse(session.user.id, date, formData, existing, allowedGroupIds);
  if (result.status === "success") revalidatePath("/");
  return result;
}
