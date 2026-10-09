import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { recordNotification } from "@/lib/notifications";
import { getMailer, getFromAddress } from "@/lib/mailer";
import { buildNewsletter, personalizeGreeting } from "@/lib/newsletter";
import { diskPathFor } from "@/lib/response-photos";
import { formatLocalDate } from "@/lib/date";

export type SendResult = {
  status: "sent" | "partial" | "failed" | "already_sent";
  recipientCount: number;
  responseCount: number;
  error?: string;
};

// Las fotos llegan tal cual salen del celular (1–3 MB cada una, hasta
// 4000px) y en el correo se muestran a 200px de ancho. Sin reducirlas, un
// día con 9 fotos armó un correo de ~22 MB (base64) — al filo del límite
// de 25 MB de Gmail, y los clientes de correo (sobre todo en celular) no
// descargan partes incrustadas tan pesadas, así que las fotos salían en
// blanco. Reducidas quedan en ~50 KB cada una.
const EMAIL_PHOTO_MAX_PX = 800;
const EMAIL_PHOTO_QUALITY = 75;

type InlineAttachment = { filename: string; content: Buffer; contentType: string; cid: string };

/** Reduce la foto para el correo; si sharp no la puede procesar, se manda el archivo original. */
async function emailSizedPhoto(filePath: string): Promise<{ content: Buffer; contentType: string; ext: string }> {
  try {
    const content = await sharp(filePath)
      .rotate() // aplica la orientación EXIF antes de quitar los metadatos
      .resize({ width: EMAIL_PHOTO_MAX_PX, height: EMAIL_PHOTO_MAX_PX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: EMAIL_PHOTO_QUALITY, mozjpeg: true })
      .toBuffer();
    return { content, contentType: "image/jpeg", ext: ".jpg" };
  } catch (error) {
    console.error(`[send-newsletter] No se pudo reducir ${filePath}, se manda original:`, error);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
    return { content: await fs.promises.readFile(filePath), contentType, ext };
  }
}

/**
 * Las fotos de usuario (ver src/lib/response-photos.ts) ahora requieren
 * sesión iniciada para verse por su URL directa (ver
 * src/app/IMG/respuestas/[filename]/route.ts) — un cliente de correo real
 * nunca manda cookies de sesión al cargar imágenes, así que se romperían
 * en el correo si se dejaran como <img src> normal. Esta función las saca
 * del HTML y las vuelve adjuntos embebidos (cid:), ya reducidas (ver
 * emailSizedPhoto), que sí se ven sin depender de ninguna sesión. Solo se
 * usa al mandar de verdad — el HTML que se guarda en
 * NewsletterSend.contentHtml (para la vista previa en el navegador) se
 * queda con las URLs normales.
 */
export async function embedResponsePhotosAsAttachments(html: string): Promise<{
  html: string;
  attachments: InlineAttachment[];
}> {
  const urls = [...new Set(html.match(/https?:\/\/[^"'\s]*\/IMG\/respuestas\/[^"'\s]+/g) ?? [])];
  const cidByUrl = new Map<string, string>();
  const attachments: InlineAttachment[] = [];

  for (const url of urls) {
    const relativePath = url.slice(url.indexOf("/IMG/respuestas/") + 1);
    const filePath = diskPathFor(relativePath);
    if (!fs.existsSync(filePath)) continue;

    const cid = `photo-${attachments.length}@whenygh`;
    const { content, contentType, ext } = await emailSizedPhoto(filePath);
    const filename = path.basename(relativePath, path.extname(relativePath)) + ext;
    attachments.push({ filename, content, contentType, cid });
    cidByUrl.set(url, cid);
  }

  const patchedHtml = html.replace(/https?:\/\/[^"'\s]*\/IMG\/respuestas\/[^"'\s]+/g, (match) => {
    const cid = cidByUrl.get(match);
    return cid ? `cid:${cid}` : match;
  });

  return { html: patchedHtml, attachments };
}

/**
 * Manda `content` a todos los usuarios activos, cada uno con su saludo
 * personalizado y las fotos de respuestas incrustadas como adjuntos. Lo
 * usan el boletín diario y el de cumpleaños (src/lib/send-birthday.ts).
 */
export async function deliverToActiveUsers({
  content,
  subject,
  greetingTemplate,
  settings,
  notification,
}: {
  content: { html: string; text: string };
  subject: string;
  greetingTemplate: string;
  settings: { fromName: string; fromEmail: string };
  /** Notificación en el sitio para cada quien al que le llegó; lleva a /boletines. */
  notification: { kind: string; title: string; url: string; text: string };
}): Promise<{ recipients: { email: string }[]; failures: string[] }> {
  const recipients = await prisma.user.findMany({ where: { active: true } });

  const transport = getMailer();
  const from = settings.fromName
    ? `${settings.fromName} <${settings.fromEmail || getFromAddress().replace(/.*<|>/g, "")}>`
    : getFromAddress();

  const { html: emailHtml, attachments } = await embedResponsePhotosAsAttachments(content.html);
  const emailContent = { html: emailHtml, text: content.text };

  const failures: string[] = [];

  await Promise.all(
    recipients.map(async (recipient) => {
      const { html, text } = personalizeGreeting(emailContent, recipient.name, greetingTemplate);
      try {
        const result = await transport.sendMail({
          to: recipient.email,
          from,
          subject,
          text,
          html,
          attachments,
        });
        const rejected = (result.rejected ?? []).concat(result.pending ?? []).filter(Boolean);
        if (rejected.length) failures.push(recipient.email);
        else await recordNotification({ userId: recipient.id, ...notification });
      } catch {
        failures.push(recipient.email);
      }
    })
  );

  return { recipients, failures };
}

/**
 * Envía el boletín del día indicado. Idempotente por fecha salvo `force`
 * (usado por el botón "Reenviar" del panel de admin).
 */
export async function sendDailyNewsletter(date: string, options?: { force?: boolean }): Promise<SendResult> {
  const existing = await prisma.newsletterSend.findUnique({ where: { date } });
  if (existing && !options?.force) {
    return {
      status: "already_sent",
      recipientCount: existing.recipientCount,
      responseCount: existing.responseCount,
    };
  }

  const [content, settings] = await Promise.all([
    buildNewsletter(date),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);

  const { recipients, failures } = await deliverToActiveUsers({
    content,
    subject: `${settings.newsletterName} — ${date}`,
    greetingTemplate: settings.greetingTemplate,
    settings,
    notification: {
      kind: "newsletter",
      title: `📰 Salió el boletín del ${formatLocalDate(date)}`,
      url: `/boletines?date=${date}`,
      text: `${content.responses.length} ${content.responses.length === 1 ? "respuesta" : "respuestas"}. Toca para leer lo que hará el grupo.`,
    },
  });

  const status: SendResult["status"] =
    failures.length === 0 ? "sent" : failures.length === recipients.length ? "failed" : "partial";

  await prisma.newsletterSend.upsert({
    where: { date },
    create: {
      date,
      recipientCount: recipients.length,
      responseCount: content.responses.length,
      status,
      error: failures.length ? `Fallaron: ${failures.join(", ")}` : null,
      contentHtml: content.html,
      contentText: content.text,
      greetingTemplate: settings.greetingTemplate,
      heroJson: JSON.stringify(content.hero),
    },
    update: {
      sentAt: new Date(),
      recipientCount: recipients.length,
      responseCount: content.responses.length,
      status,
      error: failures.length ? `Fallaron: ${failures.join(", ")}` : null,
      contentHtml: content.html,
      contentText: content.text,
      greetingTemplate: settings.greetingTemplate,
      heroJson: JSON.stringify(content.hero),
    },
  });

  return {
    status,
    recipientCount: recipients.length,
    responseCount: content.responses.length,
    error: failures.length ? `Fallaron: ${failures.join(", ")}` : undefined,
  };
}
