import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Notificaciones del sitio (/notificaciones): una copia de cada correo que
 * se le mandó a alguien, para que también lo vea ahí. Se anota solo si el
 * correo salió. No entran los correos del código para iniciar sesión.
 */

/** Cuánto se guardan; el worker borra las más viejas (ver pruneNotifications). */
const KEEP_DAYS = 365;

/** Resumen corto a partir del texto plano del correo, sin el "Hola X,". */
function previewFrom(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^hola\b/i.test(l) && !/^https?:\/\//.test(l));
  const preview = lines.join(" ").replace(/\s+/g, " ");
  return preview.length > 160 ? `${preview.slice(0, 157)}…` : preview;
}

/** Ruta interna (sin dominio) para que el enlace funcione en el sitio. */
function internalUrl(url: string): string {
  const site = getSiteUrl();
  return url.startsWith(site) ? url.slice(site.length) || "/" : url;
}

export async function recordNotification({
  userId,
  kind,
  title,
  text = "",
  html = "",
  url = "",
}: {
  userId: string;
  kind: string;
  title: string;
  /** Texto plano del correo, para el resumen de la lista. */
  text?: string;
  /** El correo completo; vacío si la notificación solo lleva a `url`. */
  html?: string;
  url?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, kind, title, preview: previewFrom(text), html, url: internalUrl(url) },
    });
  } catch (error) {
    // Best-effort: nunca debe tumbar un envío de correo que sí salió.
    console.error("[notifications] No se pudo guardar la notificación:", error);
  }
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function pruneNotifications(): Promise<number> {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
