"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { todayLocalDate } from "@/lib/date";
import { writeResponse, type SaveResponseState } from "@/lib/save-response";
import { EXTRAORDINARY_PATH, notifyExtraordinaryResponse } from "@/lib/extraordinary";

/**
 * Guarda la respuesta extraordinaria para el día elegido. Se salta el
 * bloqueo tras el envío (ese es el punto), pero solo con un permiso sin
 * usar para ese día, la página habilitada y sin respuesta previa ese día.
 */
export async function saveExtraordinaryResponse(
  _prevState: SaveResponseState,
  formData: FormData
): Promise<SaveResponseState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "Tu sesión expiró, vuelve a entrar." };
  }
  const userId = session.user.id;

  if (!rateLimit(`response-extra:${userId}`, 15, 5 * 60 * 1000)) {
    return { status: "error", message: "Demasiados intentos seguidos. Espera un momento e intenta de nuevo." };
  }

  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: "error", fieldErrors: { date: "Elige el día de tu respuesta." }, message: "Revisa los campos marcados." };
  }

  const [settings, grant, existing] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.extraordinaryGrant.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.response.findUnique({ where: { userId_date: { userId, date } } }),
  ]);

  if (!settings.extraordinaryResponsesEnabled || !grant || date >= todayLocalDate()) {
    return { status: "error", message: "No tienes un privilegio activo para ese día." };
  }
  if (grant.usedAt) {
    return { status: "error", message: "Ya usaste tu privilegio para ese día." };
  }
  if (existing) {
    return { status: "error", message: "Ya tienes una respuesta para ese día." };
  }

  // Se aparta el permiso antes de guardar, para que dos envíos seguidos no
  // lo usen dos veces; si la respuesta no se guarda, se suelta.
  const { count } = await prisma.extraordinaryGrant.updateMany({
    where: { id: grant.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) {
    return { status: "error", message: "Ya usaste tu privilegio para ese día." };
  }

  let result: SaveResponseState;
  try {
    result = await writeResponse(userId, date, formData, null);
  } catch (error) {
    await prisma.extraordinaryGrant.update({ where: { id: grant.id }, data: { usedAt: null } });
    throw error;
  }
  if (result.status !== "success") {
    await prisma.extraordinaryGrant.update({ where: { id: grant.id }, data: { usedAt: null } });
    return result;
  }

  void notifyExtraordinaryResponse(userId, date);
  revalidatePath(EXTRAORDINARY_PATH);
  revalidatePath("/boletines");
  return result;
}
