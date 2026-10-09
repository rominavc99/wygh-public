import { prisma } from "@/lib/prisma";
import { getMailer, getFromAddress } from "@/lib/mailer";
import { displayName } from "@/lib/display-name";
import { getSiteUrl } from "@/lib/site-url";
import { communicationResultEmailHtml, communicationResultEmailText } from "@/lib/communication-result-email";
import { recordNotification } from "@/lib/notifications";

/**
 * Avisa a todos los admins activos cómo salió una comunicación PROGRAMADA
 * ya procesada (por worker.ts) — a diferencia de "Enviar ahora", nadie
 * está mirando la pantalla cuando el worker la dispara, así que este
 * correo es el único aviso del resultado. Best-effort: un fallo acá no
 * debe tumbar el procesamiento de otras comunicaciones pendientes.
 */
export async function notifyAdminsOfScheduledResult(communicationId: string): Promise<void> {
  try {
    const comm = await prisma.communication.findUnique({ where: { id: communicationId } });
    if (!comm || comm.status === "scheduled") return;

    const [admins, settings] = await Promise.all([
      prisma.user.findMany({ where: { role: "ADMIN", active: true } }),
      prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    ]);
    if (admins.length === 0) return;

    const from = settings.fromName
      ? `${settings.fromName} <${settings.fromEmail || getFromAddress().replace(/.*<|>/g, "")}>`
      : getFromAddress();
    const viewUrl = `${getSiteUrl()}/admin/comunicaciones/${comm.id}`;
    const status = comm.status as "sent" | "partial" | "failed";
    const subjectLine =
      status === "sent" ? `✅ Comunicación enviada: ${comm.subject}` : `⚠️ Problema al enviar: ${comm.subject}`;

    await Promise.allSettled(
      admins.map(async (admin) => {
        const args = {
          name: displayName(admin),
          subject: comm.subject,
          status,
          recipientCount: comm.recipientCount,
          error: comm.error,
          viewUrl,
        };
        const text = communicationResultEmailText(args);
        const html = communicationResultEmailHtml(args);
        await getMailer().sendMail({ to: admin.email, from, subject: subjectLine, text, html });
        await recordNotification({ userId: admin.id, kind: "admin", title: subjectLine, text, html });
      })
    );
  } catch (error) {
    console.error("No se pudo notificar a los admins del resultado de la comunicación:", error);
  }
}
