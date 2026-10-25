import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ApiError, badRequest, str } from "@/lib/api/http";
import { commentDto, reactionsDto } from "@/lib/api/dto";
import type { InteractionResult } from "@/lib/interactions";

// Piezas comunes de las rutas de reacciones y comentarios de la API.

export function reactionInput(body: Record<string, unknown>) {
  const emoji = str(body.emoji).trim();
  const kind = body.kind === "ascii" ? "ascii" : "emoji";
  if (!emoji) throw badRequest('Falta "emoji".');
  return { emoji, kind } as const;
}

export function ensureInteractionOk(result: InteractionResult): void {
  if (!result.ok) throw new ApiError(403, "not_allowed", result.message);
}

/** El comentario de la API como FormData (lo que espera src/lib/interactions.ts). */
export function commentForm(body: Record<string, unknown>): FormData {
  const form = new FormData();
  form.set("text", str(body.text));
  if (Array.isArray(body.mentionIds)) form.set("mentions", JSON.stringify(body.mentionIds.filter((v) => typeof v === "string")));
  if (body.replyToId) form.set("replyToId", str(body.replyToId));
  if (body.removePhoto === true) form.set("removePhoto", "on");
  const photo = body.photo as { data?: unknown; type?: unknown } | undefined;
  if (photo) {
    if (typeof photo.data !== "string" || typeof photo.type !== "string") throw badRequest('"photo" tiene que ser { data, type }.');
    form.set("photoData", photo.data);
    form.set("photoType", photo.type);
  }
  return form;
}

export async function responseReactions(responseId: string, groupId: string, viewerId: string) {
  const rows = await prisma.reaction.findMany({ where: { responseId, groupId }, include: { user: true } });
  revalidatePath("/boletines");
  return { reactions: reactionsDto(rows, viewerId) };
}

export async function missionReactions(missionId: string, groupId: string, viewerId: string) {
  const rows = await prisma.missionReaction.findMany({ where: { missionId, groupId }, include: { user: true } });
  revalidatePath("/boletines");
  return { reactions: reactionsDto(rows, viewerId) };
}

export async function commentWithExtras(commentId: string, viewerId: string) {
  const c = await prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    include: { user: true, reactions: { include: { user: true } }, mentions: { include: { user: true } } },
  });
  revalidatePath("/boletines");
  return commentDto(c, viewerId);
}
