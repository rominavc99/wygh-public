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
  // Los grupos que la tenían fija vuelven a modo aleatorio.
  await prisma.group.updateMany({ where: { selectedPhraseId: id }, data: { selectedPhraseId: "" } });
  revalidatePath("/admin/frases");
  revalidatePath("/admin/boletin");
}

/** Fija la frase `id` en el grupo (o la quita, con id vacío: vuelve a modo aleatorio). */
export async function selectPhrase(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  const groupId = formData.get("groupId");
  if (typeof id !== "string" || typeof groupId !== "string" || !groupId) return;

  await prisma.group.update({ where: { id: groupId }, data: { selectedPhraseId: id } });
  revalidatePath("/admin/grupos");
  revalidatePath("/admin/frases");
  revalidatePath("/admin/boletin");
}
