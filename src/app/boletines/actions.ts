"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import * as interactions from "@/lib/interactions";
import type { AddCommentState } from "@/lib/interactions";

// Server Actions de /boletines: la lógica vive en src/lib/interactions.ts
// (la comparte la API); aquí solo se toma el usuario de la sesión y se
// refresca la página.

export type { AddCommentState };

/** Agrega la reacción si no existía, o la quita si el usuario ya había reaccionado igual (toggle). */
export async function toggleReaction(responseId: string, groupId: string, emoji: string, kind: "emoji" | "ascii") {
  await interactions.toggleReaction(await requireUser(), responseId, groupId, emoji, kind);
  revalidatePath("/boletines");
}

/** Igual que toggleReaction, pero sobre una misión cumplida. */
export async function toggleMissionReaction(missionId: string, groupId: string, emoji: string, kind: "emoji" | "ascii") {
  await interactions.toggleMissionReaction(await requireUser(), missionId, groupId, emoji, kind);
  revalidatePath("/boletines");
}

/** Igual que toggleReaction, pero sobre un comentario. */
export async function toggleCommentReaction(commentId: string, emoji: string, kind: "emoji" | "ascii") {
  await interactions.toggleCommentReaction(await requireUser(), commentId, emoji, kind);
  revalidatePath("/boletines");
}

/** Comenta una respuesta, o una misión cumplida si viene `missionId`. */
export async function addComment(
  responseId: string,
  groupId: string,
  missionId: string | null,
  _prevState: AddCommentState,
  formData: FormData
): Promise<AddCommentState> {
  const result = await interactions.addComment(await requireUser(), responseId, groupId, missionId, formData);
  if (result.status === "error") return result;
  revalidatePath("/boletines");
  return { status: "idle" };
}

/** Edita un comentario propio (texto, etiquetas y foto). */
export async function editComment(commentId: string, _prevState: AddCommentState, formData: FormData): Promise<AddCommentState> {
  const result = await interactions.editComment(await requireUser(), commentId, formData);
  if (result.status === "idle") revalidatePath("/boletines");
  return result;
}
