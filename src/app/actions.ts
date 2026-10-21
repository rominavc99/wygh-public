"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { todayLocalDate } from "@/lib/date";
import { writeResponse, type SaveResponseState } from "@/lib/save-response";

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

  const result = await writeResponse(session.user.id, date, formData, existing);
  if (result.status === "success") revalidatePath("/");
  return result;
}
