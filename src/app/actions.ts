"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { submitDailyResponse, type SaveResponseState } from "@/lib/save-response";

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

  const result = await submitDailyResponse(session.user.id, formData);
  if (result.status === "success") {
    revalidatePath("/");
    revalidatePath("/misiones");
  }
  return result;
}
