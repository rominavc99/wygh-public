import "dotenv/config";
import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { sendDailyNewsletter } from "@/lib/send-newsletter";
import { sendReminderIfNeeded } from "@/lib/send-reminder";
import { sendBirthdayNewsletter, birthdayPeopleOn, birthdayGroupsOf } from "@/lib/send-birthday";
import { sendCommunicationNow } from "@/lib/send-communication";
import { notifyAdminsOfScheduledResult } from "@/lib/notify-admins";
import { sendWeeklySummary, sendInactivityNudges } from "@/lib/send-engagement";
import { sendDailyExtras } from "@/lib/send-extras";
import { pruneNotifications } from "@/lib/notifications";
import { expireMissions } from "@/lib/missions";
import { todayLocalDate, nowLocalTime, subtractMinutesFromTime } from "@/lib/date";

// Cada grupo tiene su propia hora de envío (y su recordatorio 1 hora
// antes); los grupos en pausa no mandan nada.
async function checkAndSend() {
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  if (!settings.autoSend) return;
  const now = nowLocalTime();
  const groups = await prisma.group.findMany({ where: { suspended: false, sendTime: now } });
  const date = todayLocalDate();

  for (const group of groups) {
    const existing = await prisma.newsletterSend.findUnique({ where: { groupId_date: { groupId: group.id, date } } });
    if (existing) continue;

    console.log(`[worker] Hora de envío de "${group.name}" (${group.sendTime}). Enviando boletín del ${date}...`);
    const result = await sendDailyNewsletter(group.id, date);
    console.log(
      `[worker] "${group.name}": ${result.status} — ${result.recipientCount} destinatarios, ${result.responseCount} respuestas.` +
        (result.error ? ` Error: ${result.error}` : "")
    );
  }
}

async function checkAndSendReminder() {
  const now = nowLocalTime();
  const groups = await prisma.group.findMany({ where: { suspended: false, reminderEnabled: true } });
  const date = todayLocalDate();

  for (const group of groups) {
    if (now !== subtractMinutesFromTime(group.sendTime, 60)) continue;
    const result = await sendReminderIfNeeded(group.id, date);
    if (result.status === "sent") {
      console.log(`[worker] Recordatorio de "${group.name}" enviado a ${result.recipientCount} persona(s) que faltaban responder.`);
    }
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
    // Una edición por cada grupo de quien cumple años, solo a ese grupo.
    for (const group of await birthdayGroupsOf(user.id)) {
      console.log(`[worker] Hoy cumple años ${user.name}. Enviando su boletín de cumpleaños a "${group.name}"...`);
      const result = await sendBirthdayNewsletter(user.id, group.id, date);
      console.log(
        `[worker] Cumpleaños de ${user.name} en "${group.name}": ${result.status} — ${result.recipientCount} destinatarios, ${result.momentCount} momentos.` +
          (result.error ? ` Error: ${result.error}` : "")
      );
    }
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

async function checkAndSendWeeklySummary() {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  if (!settings.weeklySummaryEnabled) return;
  if (new Date().getDay() !== settings.weeklySummaryDay) return;
  if (nowLocalTime() !== settings.weeklySummaryTime) return;

  const results = await sendWeeklySummary(todayLocalDate());
  for (const result of results) {
    console.log(`[worker] Resumen semanal: ${result.status} — ${result.recipientCount} destinatarios.`);
  }
}

async function checkAndSendInactivityNudges() {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  if (!settings.inactivityNudgeEnabled) return;
  if (nowLocalTime() !== settings.inactivityNudgeTime) return;

  const result = await sendInactivityNudges(todayLocalDate());
  if (result.sent || result.failed) {
    console.log(`[worker] Correos de inactividad: ${result.sent} enviados, ${result.failed} fallidos.`);
  }
}

async function checkAndSendExtras() {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  if (nowLocalTime() !== settings.extrasEmailTime) return;

  const result = await sendDailyExtras(todayLocalDate());
  const summary = Object.entries(result)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} de ${kind}`);
  if (summary.length) console.log(`[worker] Correos especiales: ${summary.join(", ")}.`);
}

// Misiones cuyo resumen ya cerró sin entregarse: pasan a incumplidas.
async function checkExpiredMissions() {
  const { failed } = await expireMissions();
  if (failed) console.log(`[worker] ${failed} misión(es) sin cumplir; se mandaron las advertencias.`);
}

// Notificaciones de más de un año: una vez al día, de madrugada.
cron.schedule("30 3 * * *", () => {
  pruneNotifications()
    .then((count) => {
      if (count) console.log(`[worker] Se borraron ${count} notificaciones viejas.`);
    })
    .catch((error) => console.error("[worker] Error al borrar notificaciones viejas:", error));
});

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
  checkAndSendWeeklySummary().catch((error) => {
    console.error("[worker] Error al mandar el resumen semanal:", error);
  });
  checkAndSendInactivityNudges().catch((error) => {
    console.error("[worker] Error al mandar correos de inactividad:", error);
  });
  checkAndSendExtras().catch((error) => {
    console.error("[worker] Error al mandar correos especiales:", error);
  });
  checkExpiredMissions().catch((error) => {
    console.error("[worker] Error al revisar misiones vencidas:", error);
  });
});

console.log("[worker] Worker de boletín iniciado. Revisando cada minuto la hora de envío, de recordatorio, de cumpleaños, del resumen semanal, de los correos de inactividad y de los especiales.");
