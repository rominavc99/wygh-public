import { prisma } from "@/lib/prisma";
import { getMailer, getFromAddress } from "@/lib/mailer";
import { displayName } from "@/lib/display-name";
import { interactionEmailHtml, interactionEmailText } from "@/lib/interaction-email";
import { getSiteUrl } from "@/lib/site-url";
import { recordNotification } from "@/lib/notifications";

/**
 * Avisa por correo al dueño de una respuesta que alguien reaccionó o
 * comentó en ella (o, con notifyCommentReaction, al autor de un comentario
 * que alguien reaccionó a él). Best-effort: un error de envío no debe tumbar la
 * acción del usuario que reaccionó/comentó (por eso el try/catch acá
 * adentro en vez de dejar que la excepción suba).
 */
export async function notifyResponseInteraction({
  responseId,
  actorId,
  message,
}: {
  responseId: string;
  actorId: string;
  message: string;
}): Promise<void> {
  try {
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      select: { date: true, user: true },
    });
    if (!response) return;
    await notifyUser({ recipient: response.user, date: response.date, actorId, message });
  } catch (error) {
    console.error("No se pudo enviar la notificación de interacción:", error);
  }
}

/** Avisa a quien escribió un comentario que alguien reaccionó a él. Best-effort, igual que arriba. */
export async function notifyCommentReaction({
  commentId,
  actorId,
  emoji,
}: {
  commentId: string;
  actorId: string;
  emoji: string;
}): Promise<void> {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { user: true, response: { select: { date: true } } },
    });
    if (!comment) return;
    await notifyUser({ recipient: comment.user, date: comment.response.date, actorId, message: `reaccionó ${emoji} a tu comentario` });
  } catch (error) {
    console.error("No se pudo enviar la notificación de interacción:", error);
  }
}

async function notifyUser({
  recipient,
  date,
  actorId,
  message,
  quote,
}: {
  recipient: { id: string; name: string; username: string | null; email: string; active: boolean };
  date: string;
  actorId: string;
  message: string;
  /** Texto del comentario, para mostrarlo en el correo y en la notificación. */
  quote?: string;
}): Promise<void> {
  if (recipient.id === actorId || !recipient.active) return;

  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) return;

  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const from = settings.fromName ? `${settings.fromName} <${getFromAddress().replace(/.*<|>/g, "")}>` : getFromAddress();
  const boletinUrl = `${getSiteUrl()}/boletines?date=${date}`;
  const actorName = displayName(actor);
  const recipientName = displayName(recipient);

  const subject = `💬 ${actorName} ${message}`;
  await getMailer().sendMail({
    to: recipient.email,
    from,
    subject,
    text: interactionEmailText({ name: recipientName, actorName, message, quote, boletinUrl }),
    html: interactionEmailHtml({ name: recipientName, actorName, message, quote, boletinUrl }),
  });
  // Lleva directo al boletín (ahí está la reacción o el comentario).
  await recordNotification({
    userId: recipient.id,
    kind: "interaction",
    title: subject,
    text: quote ? `"${quote}"` : "Toca para verlo en el boletín.",
    url: boletinUrl,
  });
}

/**
 * Avisa de un comentario nuevo a quien corresponda, una sola vez por
 * persona y con el aviso más específico: a quien le respondieron, luego
 * a quien etiquetaron y al final al dueño de la respuesta. Nunca a quien
 * comentó. Best-effort, como los de arriba. Con onlyMentions (al editar
 * un comentario) solo se avisa a las personas etiquetadas.
 */
export async function notifyNewComment({
  commentId,
  actorId,
  replyToUserId,
  mentionedIds,
  onlyMentions = false,
}: {
  commentId: string;
  actorId: string;
  replyToUserId: string | null;
  mentionedIds: string[];
  onlyMentions?: boolean;
}): Promise<void> {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { text: true, photoFilename: true, response: { select: { date: true, userId: true } } },
    });
    if (!comment) return;

    const messages = new Map<string, string>();
    if (replyToUserId) messages.set(replyToUserId, "respondió a tu comentario");
    for (const id of mentionedIds) if (!messages.has(id)) messages.set(id, "te etiquetó en un comentario");
    if (!onlyMentions && !messages.has(comment.response.userId)) messages.set(comment.response.userId, "comentó tu respuesta");
    messages.delete(actorId);

    // Un comentario puede ser solo una foto (sin texto).
    const text = comment.text || (comment.photoFilename ? "📷 Foto" : "");
    const quote = text.length > 200 ? `${text.slice(0, 197)}…` : text;
    const recipients = await prisma.user.findMany({ where: { id: { in: [...messages.keys()] } } });
    await Promise.all(
      recipients.map((recipient) =>
        notifyUser({ recipient, date: comment.response.date, actorId, message: messages.get(recipient.id)!, quote })
      )
    );
  } catch (error) {
    console.error("No se pudo enviar la notificación del comentario:", error);
  }
}
