import { prisma } from "@/lib/prisma";
import { getMailer, getFromAddress } from "@/lib/mailer";
import { displayName } from "@/lib/display-name";
import { communicationEmailHtml, communicationEmailText } from "@/lib/communication-email";
import { recordNotification } from "@/lib/notifications";

/**
 * Manda un Communication ya creado (audiencia y contenido ya resueltos en
 * la fila). La llama tanto la acción de "Enviar ahora" (de inmediato,
 * awaited) como worker.ts (cada minuto, para los que ya llegaron a su
 * scheduledAt) — por eso es idempotente vía el chequeo de status.
 */
export async function sendCommunicationNow(id: string): Promise<void> {
  const comm = await prisma.communication.findUnique({ where: { id } });
  if (!comm || comm.status !== "scheduled") return;

  const [recipients, settings] = await Promise.all([
    comm.audience === "selected"
      ? prisma.user.findMany({
          where: { id: { in: JSON.parse(comm.recipientIds || "[]") as string[] }, active: true },
        })
      : prisma.user.findMany({ where: { active: true } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);

  const transport = getMailer();
  const from = settings.fromName
    ? `${settings.fromName} <${settings.fromEmail || getFromAddress().replace(/.*<|>/g, "")}>`
    : getFromAddress();

  const failures: string[] = [];

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        const text = communicationEmailText({ name: displayName(recipient), bodyText: comm.bodyText });
        const html = communicationEmailHtml({
          name: displayName(recipient),
          subject: comm.subject,
          bodyHtml: comm.bodyHtml,
        });
        const result = await transport.sendMail({ to: recipient.email, from, subject: comm.subject, text, html });
        const rejected = (result.rejected ?? []).concat(result.pending ?? []).filter(Boolean);
        if (rejected.length) failures.push(recipient.email);
        else await recordNotification({ userId: recipient.id, kind: "communication", title: `📣 ${comm.subject}`, text, html });
      } catch {
        failures.push(recipient.email);
      }
    })
  );

  const status =
    failures.length === 0 ? "sent" : failures.length === recipients.length ? "failed" : "partial";

  await prisma.communication.update({
    where: { id },
    data: {
      status,
      sentAt: new Date(),
      recipientCount: recipients.length,
      error: failures.length ? `Fallaron: ${failures.join(", ")}` : null,
    },
  });
}
