"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { notifyResponseInteraction, notifyCommentReaction } from "@/lib/notify-interaction";

/** Agrega la reacción si no existía, o la quita si el usuario ya había reaccionado igual (toggle). */
export async function toggleReaction(responseId: string, emoji: string, kind: "emoji" | "ascii") {
  const user = await requireUser();

  if (!rateLimit(`reaction:${user.id}`, 60, 60 * 1000)) return;

  const trimmed = emoji.trim();
  if (!trimmed || trimmed.length > 40) return;

  const existing = await prisma.reaction.findUnique({
    where: { responseId_userId_emoji: { responseId, userId: user.id, emoji: trimmed } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({ data: { responseId, userId: user.id, emoji: trimmed, kind } });
    // Sin await a propósito: el envío del correo no debe retrasar el toggle
    // que el usuario está esperando ver reflejado de inmediato en la UI.
    void notifyResponseInteraction({ responseId, actorId: user.id, message: `reaccionó ${trimmed} a tu respuesta` });
  }

  revalidatePath("/boletines");
}

/** Igual que toggleReaction, pero sobre un comentario. Avisa por correo a quien lo escribió. */
export async function toggleCommentReaction(commentId: string, emoji: string, kind: "emoji" | "ascii") {
  const user = await requireUser();

  if (!rateLimit(`reaction:${user.id}`, 60, 60 * 1000)) return;

  const trimmed = emoji.trim();
  if (!trimmed || trimmed.length > 40) return;

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
  if (!comment) return;

  const existing = await prisma.commentReaction.findUnique({
    where: { commentId_userId_emoji: { commentId, userId: user.id, emoji: trimmed } },
  });

  if (existing) {
    await prisma.commentReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.commentReaction.create({ data: { commentId, userId: user.id, emoji: trimmed, kind } });
    void notifyCommentReaction({ commentId, actorId: user.id, emoji: trimmed });
  }

  revalidatePath("/boletines");
}

const commentSchema = z.string().trim().min(1, "Escribe algo.").max(1000);

export type AddCommentState = { status: "idle" } | { status: "error"; message: string };

export async function addComment(
  responseId: string,
  _prevState: AddCommentState,
  formData: FormData
): Promise<AddCommentState> {
  const user = await requireUser();

  if (!rateLimit(`comment:${user.id}`, 30, 5 * 60 * 1000)) {
    return { status: "error", message: "Demasiados comentarios seguidos. Espera un momento." };
  }

  const parsed = commentSchema.safeParse(formData.get("text"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Escribe algo." };
  }

  await prisma.comment.create({ data: { responseId, userId: user.id, text: parsed.data } });
  void notifyResponseInteraction({ responseId, actorId: user.id, message: "comentó tu respuesta" });
  revalidatePath("/boletines");
  return { status: "idle" };
}
