"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";

export type PhraseFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string };

const phraseSchema = z.string().trim().min(1, "Escribe una frase.").max(300);

export async function createPhrase(
  _prevState: PhraseFormState,
  formData: FormData
): Promise<PhraseFormState> {
  await requireAdmin();

  const parsed = phraseSchema.safeParse(formData.get("text"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await prisma.phrase.create({ data: { text: parsed.data } });
  revalidatePath("/admin/frases");
  revalidatePath("/admin/boletin");
  return { status: "success" };
}

export async function deletePhrase(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.phrase.delete({ where: { id } });
  // Si esta frase era la seleccionada a mano, vuelve a modo aleatorio.
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (settings?.selectedPhraseId === id) {
    await prisma.settings.update({ where: { id: 1 }, data: { selectedPhraseId: "" } });
  }
  revalidatePath("/admin/frases");
  revalidatePath("/admin/boletin");
}

export async function selectPhrase(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, selectedPhraseId: id },
    update: { selectedPhraseId: id },
  });
  revalidatePath("/admin/frases");
  revalidatePath("/admin/boletin");
}
