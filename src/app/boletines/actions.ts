"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { notifyResponseInteraction, notifyCommentReaction, notifyNewComment } from "@/lib/notify-interaction";
import { displayName } from "@/lib/display-name";
import {
  photoFromFormData,
  validatePhoto,
  saveCommentPhoto,
  deleteResponsePhotoFile,
  type IncomingPhoto,
} from "@/lib/response-photos";
import { canAccessGroup, canInteractInGroup } from "@/lib/groups";

// Reacciones y comentarios van dentro de un grupo (los grupos están
// aislados): solo puede interactuar quien tiene acceso al grupo, y solo
// sobre respuestas que se mandaron a ese grupo.

/** Agrega la reacción si no existía, o la quita si el usuario ya había reaccionado igual (toggle). */
export async function toggleReaction(responseId: string, groupId: string, emoji: string, kind: "emoji" | "ascii") {
  const user = await requireUser();

  if (!rateLimit(`reaction:${user.id}`, 60, 60 * 1000)) return;

  const trimmed = emoji.trim();
  if (!trimmed || trimmed.length > 40) return;
  if (!(await canInteractInGroup(user, responseId, groupId))) return;

  const existing = await prisma.reaction.findUnique({
    where: { responseId_groupId_userId_emoji: { responseId, groupId, userId: user.id, emoji: trimmed } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({ data: { responseId, groupId, userId: user.id, emoji: trimmed, kind } });
    // Sin await a propósito: el envío del correo no debe retrasar el toggle
    // que el usuario está esperando ver reflejado de inmediato en la UI.
    void notifyResponseInteraction({ responseId, groupId, actorId: user.id, message: `reaccionó ${trimmed} a tu respuesta` });
  }

  revalidatePath("/boletines");
}

/** Igual que toggleReaction, pero sobre un comentario. Avisa por correo a quien lo escribió. */
export async function toggleCommentReaction(commentId: string, emoji: string, kind: "emoji" | "ascii") {
  const user = await requireUser();

  if (!rateLimit(`reaction:${user.id}`, 60, 60 * 1000)) return;

  const trimmed = emoji.trim();
  if (!trimmed || trimmed.length > 40) return;

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { groupId: true } });
  if (!comment || !(await canAccessGroup(user, comment.groupId))) return;

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

const commentSchema = z.string().trim().max(1000, "Máximo 1000 caracteres.");

export type AddCommentState = { status: "idle" } | { status: "error"; message: string };

/**
 * Lee lo común a crear y editar un comentario: el texto, la foto nueva (en
 * base64, igual que la del formulario diario — ver photoFromFormData) y las
 * etiquetas. Solo cuentan las etiquetas de personas activas del grupo cuyo
 * "@Nombre" siga en el texto (por si lo borraron después de elegirlo en la
 * lista).
 */
async function parseCommentForm(
  formData: FormData,
  { hasPhotoAlready, groupId }: { hasPhotoAlready: boolean; groupId: string }
): Promise<
  | { ok: true; text: string; photo: IncomingPhoto | null; removePhoto: boolean; mentioned: { id: string }[] }
  | { ok: false; message: string }
> {
  const parsed = commentSchema.safeParse(formData.get("text") ?? "");
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el comentario." };
  const text = parsed.data;

  const photo = photoFromFormData(formData);
  if (photo) {
    const error = await validatePhoto(photo);
    if (error) return { ok: false, message: error };
  }
  const removePhoto = !photo && formData.get("removePhoto") === "on";

  // Un comentario puede ser solo texto, solo foto o las dos cosas.
  if (!text && !photo && (removePhoto || !hasPhotoAlready)) {
    return { ok: false, message: "Escribe algo o agrega una foto." };
  }

  let mentionIds: string[] = [];
  try {
    const raw = JSON.parse(String(formData.get("mentions") ?? "[]"));
    if (Array.isArray(raw)) mentionIds = [...new Set(raw.filter((id): id is string => typeof id === "string"))].slice(0, 20);
  } catch {
    mentionIds = [];
  }
  const mentioned = mentionIds.length
    ? (
        await prisma.user.findMany({
          where: { id: { in: mentionIds }, active: true, groupMemberships: { some: { groupId } } },
        })
      ).filter((u) =>
        text.includes(`@${displayName(u)}`)
      )
    : [];

  return { ok: true, text, photo, removePhoto, mentioned };
}

export async function addComment(
  responseId: string,
  groupId: string,
  _prevState: AddCommentState,
  formData: FormData
): Promise<AddCommentState> {
  const user = await requireUser();

  if (!rateLimit(`comment:${user.id}`, 30, 5 * 60 * 1000)) {
    return { status: "error", message: "Demasiados comentarios seguidos. Espera un momento." };
  }
  if (!(await canInteractInGroup(user, responseId, groupId))) {
    return { status: "error", message: "No puedes comentar en este grupo." };
  }

  const form = await parseCommentForm(formData, { hasPhotoAlready: false, groupId });
  if (!form.ok) return { status: "error", message: form.message };

  // Respuesta a un comentario: el hilo tiene un solo nivel, así que si se
  // responde a una respuesta, cuelga del mismo comentario de primer nivel
  // (y a quien escribió la respuesta se le avisa igual).
  const replyToId = String(formData.get("replyToId") ?? "");
  let parentId: string | null = null;
  let replyToUserId: string | null = null;
  if (replyToId) {
    const target = await prisma.comment.findUnique({
      where: { id: replyToId },
      select: { responseId: true, groupId: true, parentId: true, userId: true },
    });
    if (!target || target.responseId !== responseId || target.groupId !== groupId) {
      return { status: "error", message: "Ese comentario ya no existe." };
    }
    parentId = target.parentId ?? replyToId;
    replyToUserId = target.userId;
  }

  const photoFilename = form.photo ? await saveCommentPhoto(user.id, form.photo) : null;

  const comment = await prisma.comment.create({
    data: {
      responseId,
      groupId,
      userId: user.id,
      text: form.text,
      photoFilename,
      parentId,
      mentions: { create: form.mentioned.map((u) => ({ userId: u.id })) },
    },
  });
  void notifyNewComment({
    commentId: comment.id,
    actorId: user.id,
    replyToUserId,
    mentionedIds: form.mentioned.map((u) => u.id),
  });
  revalidatePath("/boletines");
  return { status: "idle" };
}

/**
 * Edita un comentario propio: texto, etiquetas y foto (cambiarla o
 * quitarla). Solo avisa a quienes se etiquetó recién en esta edición — al
 * resto ya se le avisó cuando se publicó.
 */
export async function editComment(
  commentId: string,
  _prevState: AddCommentState,
  formData: FormData
): Promise<AddCommentState> {
  const user = await requireUser();

  if (!rateLimit(`comment-edit:${user.id}`, 30, 5 * 60 * 1000)) {
    return { status: "error", message: "Demasiadas ediciones seguidas. Espera un momento." };
  }

  const existing = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, groupId: true, photoFilename: true, mentions: { select: { userId: true } } },
  });
  if (!existing) return { status: "error", message: "Ese comentario ya no existe." };
  if (existing.userId !== user.id) return { status: "error", message: "Solo puedes editar tus propios comentarios." };
  if (!(await canAccessGroup(user, existing.groupId))) return { status: "error", message: "Ya no estás en este grupo." };

  const form = await parseCommentForm(formData, {
    hasPhotoAlready: Boolean(existing.photoFilename),
    groupId: existing.groupId,
  });
  if (!form.ok) return { status: "error", message: form.message };

  let photoFilename = existing.photoFilename;
  if (form.photo) {
    photoFilename = await saveCommentPhoto(user.id, form.photo);
  } else if (form.removePhoto) {
    photoFilename = null;
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: {
      text: form.text,
      photoFilename,
      editedAt: new Date(),
      mentions: { deleteMany: {}, create: form.mentioned.map((u) => ({ userId: u.id })) },
    },
  });
  // La foto vieja se borra recién cuando la fila ya apunta a la nueva.
  if (existing.photoFilename && existing.photoFilename !== photoFilename) {
    await deleteResponsePhotoFile(existing.photoFilename);
  }

  const alreadyMentioned = new Set(existing.mentions.map((m) => m.userId));
  const newlyMentioned = form.mentioned.map((u) => u.id).filter((id) => !alreadyMentioned.has(id));
  if (newlyMentioned.length) {
    void notifyNewComment({
      commentId,
      actorId: user.id,
      replyToUserId: null,
      mentionedIds: newlyMentioned,
      onlyMentions: true,
    });
  }
  revalidatePath("/boletines");
  return { status: "idle" };
}
