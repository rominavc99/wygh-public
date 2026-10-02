"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";

const photoSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().max(300),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")
    .or(z.literal("")),
});

export type PhotoFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string };

export async function updateHeroPhoto(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  await requireAdmin();

  const parsed = photoSchema.safeParse({
    id: formData.get("id"),
    description: formData.get("description"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Revisa los datos de la foto." };
  }

  await prisma.heroPhoto.update({
    where: { id: parsed.data.id },
    data: {
      description: parsed.data.description || null,
      date: parsed.data.date || null,
    },
  });

  revalidatePath("/admin/fotos");
  revalidatePath("/admin/boletin");
  return { status: "success" };
}
