import "dotenv/config";
import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { sendDailyNewsletter } from "@/lib/send-newsletter";
import { sendReminderIfNeeded } from "@/lib/send-reminder";
import { sendBirthdayNewsletter, birthdayPeopleOn } from "@/lib/send-birthday";
import { sendCommunicationNow } from "@/lib/send-communication";
import { notifyAdminsOfScheduledResult } from "@/lib/notify-admins";
import { todayLocalDate, nowLocalTime, subtractMinutesFromTime } from "@/lib/date";

async function checkAndSend() {
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  if (!settings.autoSend) return;
  if (nowLocalTime() !== settings.sendTime) return;

  const date = todayLocalDate();
  const existing = await prisma.newsletterSend.findUnique({ where: { date } });
  if (existing) return;

  console.log(`[worker] Hora de envío (${settings.sendTime}) alcanzada. Enviando boletín del ${date}...`);
  const result = await sendDailyNewsletter(date);
  console.log(
    `[worker] Resultado: ${result.status} — ${result.recipientCount} destinatarios, ${result.responseCount} respuestas.` +
      (result.error ? ` Error: ${result.error}` : "")
  );
}

async function checkAndSendReminder() {
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  if (!settings.reminderEnabled) return;
  const reminderTime = subtractMinutesFromTime(settings.sendTime, 60);
  if (nowLocalTime() !== reminderTime) return;

  const date = todayLocalDate();
  const result = await sendReminderIfNeeded(date);
  if (result.status === "sent") {
    console.log(`[worker] Recordatorio enviado a ${result.recipientCount} persona(s) que faltaban responder.`);
  }
}

async function checkAndSendBirthdays() {
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  if (!settings.birthdayEnabled) return;
  if (nowLocalTime() !== settings.birthdaySendTime) return;

  const date = todayLocalDate();
  for (const user of await birthdayPeopleOn(date)) {
    console.log(`[worker] Hoy cumple años ${user.name}. Enviando boletín de cumpleaños del ${date}...`);
    const result = await sendBirthdayNewsletter(user.id, date);
    console.log(
      `[worker] Cumpleaños de ${user.name}: ${result.status} — ${result.recipientCount} destinatarios, ${result.momentCount} momentos.` +
        (result.error ? ` Error: ${result.error}` : "")
    );
  }
}

async function checkAndSendScheduledCommunications() {
  const due = await prisma.communication.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
  });

  for (const comm of due) {
    console.log(`[worker] Enviando comunicación programada "${comm.subject}"...`);
    await sendCommunicationNow(comm.id);
    // A diferencia de "Enviar ahora" (donde el admin ve el resultado en la
    // pantalla), acá nadie está mirando — este correo es el único aviso
    // de que salió bien o mal. No se espera con await el resto del catch
    // por comunicación: notifyAdminsOfScheduledResult ya atrapa sus
    // propios errores, así que un fallo del correo de aviso no debe
    // frenar el procesamiento de las siguientes comunicaciones pendientes.
    await notifyAdminsOfScheduledResult(comm.id);
  }
}

cron.schedule("* * * * *", () => {
  checkAndSend().catch((error) => {
    console.error("[worker] Error en el chequeo del cron:", error);
  });
  checkAndSendReminder().catch((error) => {
    console.error("[worker] Error en el chequeo del recordatorio:", error);
  });
  checkAndSendBirthdays().catch((error) => {
    console.error("[worker] Error al mandar boletines de cumpleaños:", error);
  });
  checkAndSendScheduledCommunications().catch((error) => {
    console.error("[worker] Error al mandar comunicaciones programadas:", error);
  });
});

console.log("[worker] Worker de boletín iniciado. Revisando cada minuto la hora de envío, de recordatorio y de cumpleaños.");
