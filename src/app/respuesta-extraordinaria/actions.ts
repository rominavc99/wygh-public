"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import type { SaveResponseState } from "@/lib/save-response";
import { EXTRAORDINARY_PATH } from "@/lib/extraordinary";
import { submitExtraordinaryResponse } from "@/lib/extraordinary-submit";

/**
 * Guarda la respuesta extraordinaria para el día elegido. Se salta el
 * bloqueo tras el envío (ese es el punto), pero solo con un permiso sin
 * usar para ese día, la página habilitada y sin respuesta previa ese día.
 * Un admin no necesita nada de eso (solo un día pasado sin respuesta): se
 * le anota un permiso ya usado a su nombre, para que quede en Ajustes y
 * el día salga en /boletines igual que los demás.
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

  const result = await submitExtraordinaryResponse(session.user, formData);
  if (result.status === "success") {
    revalidatePath(EXTRAORDINARY_PATH);
    revalidatePath("/boletines");
  }
  return result;
}
