import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { displayName } from "@/lib/display-name";
import { todayLocalDate } from "@/lib/date";
import { fromAddress, sendOne } from "@/lib/send-engagement";
import { recordNotification } from "@/lib/notifications";
import { grantEmail, boletinUpdatedEmail, grantUsedEmail } from "@/lib/extraordinary-email";

/**
 * Respuestas extraordinarias: un admin le da a alguien un permiso de un
 * solo uso (ExtraordinaryGrant) para responder un día pasado en que la app
 * le falló. Solo sirve con Settings.extraordinaryResponsesEnabled activo.
 * La respuesta no vuelve a mandar el boletín: se agrega a la fila de ese
 * día y aparece en /boletines.
 */

export const EXTRAORDINARY_PATH = "/respuesta-extraordinaria";

async function getSettings() {
  return prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/**
 * Permisos que `userId` puede usar ahora: sin usar, de un día ya pasado y
 * sin respuesta suya ese día (si respondió por otro lado, ya no aplica).
 */
export async function usableGrants(userId: string) {
  const grants = await prisma.extraordinaryGrant.findMany({
    where: { userId, usedAt: null, date: { lt: todayLocalDate() } },
    orderBy: { date: "desc" },
  });
  if (grants.length === 0) return [];
  const answered = await prisma.response.findMany({
    where: { userId, date: { in: grants.map((g) => g.date) } },
    select: { date: true },
  });
  const answeredDates = new Set(answered.map((r) => r.date));
  return grants.filter((g) => !answeredDates.has(g.date));
}

/** Los que `userId` usó en la última semana, para confirmarle que ya quedaron. */
export async function recentlyUsedGrants(userId: string) {
  return prisma.extraordinaryGrant.findMany({
    where: { userId, usedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: { usedAt: "desc" },
  });
}

/** Manda el correo del privilegio y lo anota en notifiedAt. Nunca lanza. */
export async function sendGrantEmail(grantId: string): Promise<boolean> {
  try {
    const [grant, settings] = await Promise.all([
      prisma.extraordinaryGrant.findUnique({ where: { id: grantId }, include: { user: true, grantedBy: true } }),
      getSettings(),
    ]);
    if (!grant || grant.usedAt || !grant.user.active) return false;

    const parts = grantEmail({
      name: displayName(grant.user),
      adminName: grant.grantedBy ? displayName(grant.grantedBy) : "El admin",
      date: grant.date,
      newsletterName: settings.newsletterName,
      url: `${getSiteUrl()}${EXTRAORDINARY_PATH}`,
    });
    const ok = await sendOne({ to: grant.user.email, from: fromAddress(settings), ...parts });
    if (!ok) return false;
    await prisma.extraordinaryGrant.update({ where: { id: grant.id }, data: { notifiedAt: new Date() } });
    await recordNotification({ userId: grant.user.id, kind: "extraordinary", title: parts.subject, text: parts.text, html: parts.html });
    return true;
  } catch (error) {
    console.error("[extraordinaria] No se pudo mandar el correo del privilegio:", error);
    return false;
  }
}

/** Al habilitar la página: avisa a quien tenía un permiso dado mientras estaba apagada. */
export async function sendPendingGrantEmails(): Promise<{ total: number; sent: number }> {
  const pending = await prisma.extraordinaryGrant.findMany({
    where: { notifiedAt: null, usedAt: null, user: { active: true } },
    select: { id: true },
  });
  let sent = 0;
  for (const g of pending) if (await sendGrantEmail(g.id)) sent++;
  return { total: pending.length, sent };
}

/**
 * Tras guardar una respuesta extraordinaria: a todos los activos (menos a
 * quien respondió) les avisa que el boletín de ese día cambió, sin decir
 * quién; a los admins, con el nombre. Best-effort.
 */
export async function notifyExtraordinaryResponse(userId: string, date: string): Promise<void> {
  try {
    const [actor, recipients, settings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.user.findMany({ where: { active: true, id: { not: userId } } }),
      getSettings(),
    ]);
    if (!actor) return;
    const boletinUrl = `${getSiteUrl()}/boletines?date=${date}`;
    const from = fromAddress(settings);

    for (const recipient of recipients) {
      const name = displayName(recipient);
      const parts =
        recipient.role === "ADMIN"
          ? grantUsedEmail({ name, userName: displayName(actor), date, boletinUrl })
          : boletinUpdatedEmail({ name, date, boletinUrl });
      const ok = await sendOne({ to: recipient.email, from, ...parts });
      // Lleva directo al boletín, como los avisos de reacciones.
      if (ok) await recordNotification({ userId: recipient.id, kind: "extraordinary", title: parts.subject, text: parts.text, url: boletinUrl });
    }
  } catch (error) {
    console.error("[extraordinaria] No se pudo avisar de la respuesta:", error);
  }
}
