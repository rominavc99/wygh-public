"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { todayLocalDate } from "@/lib/date";
import { MANUAL_EMAIL_KINDS, sendManualEmail, type ManualEmailKind } from "@/lib/send-now";
import { displayName } from "@/lib/display-name";
import { sendGrantEmail, sendPendingGrantEmails } from "@/lib/extraordinary";

// Los ajustes del boletín de cada grupo (saludo, hora, recordatorio,
// portada, frase fija) se editan en /admin/grupos/[id].
const settingsSchema = z
  .object({
    newsletterName: z.string().trim().min(1).max(120),
    tagline: z.string().trim().max(200),
    autoSend: z.boolean(),
    lockResponsesAfterSend: z.boolean(),
    fromName: z.string().trim().min(1).max(120),
    fromEmail: z.string().trim().toLowerCase().email().or(z.literal("")),
    weeklySummaryEnabled: z.boolean(),
    weeklySummaryDay: z.coerce.number().int().min(0).max(6),
    weeklySummaryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM."),
    inactivityNudgeEnabled: z.boolean(),
    inactivityNudgeDays: z.coerce.number().int("Escribe un número entero.").min(1, "Mínimo 1 día.").max(60, "Máximo 60 días."),
    inactivityNudgeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM."),
    inactivityNudgeSubject: z.string().trim().min(1, "Escribe un título.").max(150),
    inactivityNudgeTemplate: z.string().trim().min(1, "Escribe el mensaje.").max(600),
    extrasEmailTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM."),
    streakEmailEnabled: z.boolean(),
    onThisDayEnabled: z.boolean(),
    anniversaryEnabled: z.boolean(),
    wrappedEnabled: z.boolean(),
    welcomeEmailEnabled: z.boolean(),
  });

export type SettingsFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> };

export async function updateSettings(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse({
    newsletterName: formData.get("newsletterName"),
    tagline: formData.get("tagline"),
    autoSend: formData.get("autoSend") === "on",
    lockResponsesAfterSend: formData.get("lockResponsesAfterSend") === "on",
    fromName: formData.get("fromName"),
    fromEmail: formData.get("fromEmail"),
    weeklySummaryEnabled: formData.get("weeklySummaryEnabled") === "on",
    weeklySummaryDay: formData.get("weeklySummaryDay"),
    weeklySummaryTime: formData.get("weeklySummaryTime"),
    inactivityNudgeEnabled: formData.get("inactivityNudgeEnabled") === "on",
    inactivityNudgeDays: formData.get("inactivityNudgeDays"),
    inactivityNudgeTime: formData.get("inactivityNudgeTime"),
    inactivityNudgeSubject: formData.get("inactivityNudgeSubject"),
    inactivityNudgeTemplate: formData.get("inactivityNudgeTemplate"),
    extrasEmailTime: formData.get("extrasEmailTime"),
    streakEmailEnabled: formData.get("streakEmailEnabled") === "on",
    onThisDayEnabled: formData.get("onThisDayEnabled") === "on",
    anniversaryEnabled: formData.get("anniversaryEnabled") === "on",
    wrappedEnabled: formData.get("wrappedEnabled") === "on",
    welcomeEmailEnabled: formData.get("welcomeEmailEnabled") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors, message: "Revisa los campos marcados." };
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/admin/ajustes");
  revalidatePath("/admin/boletin");
  revalidatePath("/admin/estadisticas");
  return { status: "success" };
}

export type SendNowState = { status: "idle" } | { status: "done"; message: string; ok: boolean };

/** "Enviar ahora" de un correo; `kind` viene ligado desde el botón. No toca la programación. */
export async function sendEmailNow(
  kind: ManualEmailKind,
  _prevState: SendNowState,
  formData: FormData
): Promise<SendNowState> {
  await requireAdmin();
  if (!MANUAL_EMAIL_KINDS.includes(kind)) return { status: "done", ok: false, message: "Correo desconocido." };

  const userId = kind === "welcome" ? String(formData.get("welcomeUserId") ?? "") : undefined;
  if (kind === "welcome" && !userId) return { status: "done", ok: false, message: "Elige a quién mandarle la bienvenida." };

  const { total, sent } = await sendManualEmail(kind, todayLocalDate(), userId);
  if (total === 0) return { status: "done", ok: false, message: "Hoy no le toca a nadie, no se mandó nada." };
  if (sent === total) return { status: "done", ok: true, message: `✉️ Enviado a ${sent} ${sent === 1 ? "persona" : "personas"}.` };
  return { status: "done", ok: false, message: `Se mandó a ${sent} de ${total}; revisa los logs del servidor.` };
}

// ---------------------------------------------------------------------------
// Respuestas extraordinarias (ver src/lib/extraordinary.ts). Van aparte del
// formulario de Ajustes porque mandan correos: guardar los demás ajustes
// no debe disparar ninguno.

export type ExtraordinaryState = { status: "idle" } | { status: "done"; message: string; ok: boolean };

/** Prende o apaga la página; al prenderla avisa a quien ya tenía un permiso. */
export async function setExtraordinaryEnabled(
  _prevState: ExtraordinaryState,
  formData: FormData
): Promise<ExtraordinaryState> {
  await requireAdmin();
  const enabled = formData.get("enabled") === "on";
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, extraordinaryResponsesEnabled: enabled },
    update: { extraordinaryResponsesEnabled: enabled },
  });
  revalidatePath("/admin/ajustes");
  if (!enabled) return { status: "done", ok: true, message: "🔒 Página deshabilitada. Los privilegios pendientes quedan guardados." };

  const { total, sent } = await sendPendingGrantEmails();
  if (total === 0) return { status: "done", ok: true, message: "✨ Página habilitada." };
  return sent === total
    ? { status: "done", ok: true, message: `✨ Página habilitada y aviso mandado a ${sent} ${sent === 1 ? "persona" : "personas"}.` }
    : { status: "done", ok: false, message: `Página habilitada, pero el aviso solo salió a ${sent} de ${total}; revisa los logs del servidor.` };
}

const grantSchema = z.object({
  userId: z.string().min(1, "Elige a quién."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige el día."),
});

/** Da un permiso de un solo uso a alguien para un día pasado. */
export async function addExtraordinaryGrant(
  _prevState: ExtraordinaryState,
  formData: FormData
): Promise<ExtraordinaryState> {
  const admin = await requireAdmin();
  const parsed = grantSchema.safeParse({ userId: formData.get("userId"), date: formData.get("date") });
  if (!parsed.success) return { status: "done", ok: false, message: parsed.error.issues[0].message };
  const { userId, date } = parsed.data;

  if (date >= todayLocalDate()) return { status: "done", ok: false, message: "Elige un día que ya haya pasado." };

  const [user, response, existing, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.response.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.extraordinaryGrant.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);
  if (!user?.active) return { status: "done", ok: false, message: "Esa persona no existe o está desactivada." };
  const name = displayName(user);
  if (response) return { status: "done", ok: false, message: `${name} ya tiene una respuesta para ese día.` };
  if (existing) return { status: "done", ok: false, message: `${name} ya tiene un privilegio para ese día.` };

  const grant = await prisma.extraordinaryGrant.create({ data: { userId, date, grantedById: admin.id } });
  revalidatePath("/admin/ajustes");

  if (!settings.extraordinaryResponsesEnabled) {
    return { status: "done", ok: true, message: `👑 Listo. A ${name} le llegará el aviso cuando habilites la página.` };
  }
  return (await sendGrantEmail(grant.id))
    ? { status: "done", ok: true, message: `👑 Listo, ya le avisamos a ${name} por correo.` }
    : { status: "done", ok: false, message: `El privilegio quedó, pero no se pudo mandar el correo a ${name}; revisa los logs del servidor.` };
}

/** Quita un permiso que todavía no se usó. */
export async function removeExtraordinaryGrant(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.extraordinaryGrant.deleteMany({ where: { id, usedAt: null } });
  revalidatePath("/admin/ajustes");
}
