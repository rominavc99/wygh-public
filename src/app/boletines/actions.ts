"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { notifyResponseInteraction, notifyCommentReaction, notifyNewComment } from "@/lib/notify-interaction";
import { displayName } from "@/lib/display-name";

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

  const text = parsed.data;

  // Respuesta a un comentario: el hilo tiene un solo nivel, así que si se
  // responde a una respuesta, cuelga del mismo comentario de primer nivel
  // (y a quien escribió la respuesta se le avisa igual).
  const replyToId = String(formData.get("replyToId") ?? "");
  let parentId: string | null = null;
  let replyToUserId: string | null = null;
  if (replyToId) {
    const target = await prisma.comment.findUnique({
      where: { id: replyToId },
      select: { responseId: true, parentId: true, userId: true },
    });
    if (!target || target.responseId !== responseId) {
      return { status: "error", message: "Ese comentario ya no existe." };
    }
    parentId = target.parentId ?? replyToId;
    replyToUserId = target.userId;
  }

  // Solo cuentan las etiquetas de personas activas cuyo "@Nombre" siga en
  // el texto (por si lo borraron después de elegirlo en la lista).
  let mentionIds: string[] = [];
  try {
    const raw = JSON.parse(String(formData.get("mentions") ?? "[]"));
    if (Array.isArray(raw)) mentionIds = [...new Set(raw.filter((id): id is string => typeof id === "string"))].slice(0, 20);
  } catch {
    mentionIds = [];
  }
  const mentioned = mentionIds.length
    ? (await prisma.user.findMany({ where: { id: { in: mentionIds }, active: true } })).filter((u) =>
        text.includes(`@${displayName(u)}`)
      )
    : [];

  const comment = await prisma.comment.create({
    data: {
      responseId,
      userId: user.id,
      text,
      parentId,
      mentions: { create: mentioned.map((u) => ({ userId: u.id })) },
    },
  });
  void notifyNewComment({
    commentId: comment.id,
    actorId: user.id,
    replyToUserId,
    mentionedIds: mentioned.map((u) => u.id),
  });
  revalidatePath("/boletines");
  return { status: "idle" };
}
