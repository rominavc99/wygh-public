"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "La URL debe empezar con http:// o https://");

const settingsSchema = z
  .object({
    newsletterName: z.string().trim().min(1).max(120),
    tagline: z.string().trim().max(200),
    greetingTemplate: z
      .string()
      .trim()
      .min(1, "Escribe un saludo.")
      .max(300)
      .refine((v) => v.includes("{nombre}"), 'El saludo debe incluir el marcador "{nombre}".'),
    sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM."),
    autoSend: z.boolean(),
    reminderEnabled: z.boolean(),
    lockResponsesAfterSend: z.boolean(),
    fromName: z.string().trim().min(1).max(120),
    fromEmail: z.string().trim().toLowerCase().email().or(z.literal("")),
    heroEnabled: z.boolean(),
    heroTitle: z.string().trim().max(140),
    heroParagraph: z.string().trim().max(600),
    heroImageUrl: optionalUrl,
    heroLinkUrl: optionalUrl,
    heroLinkText: z.string().trim().max(40).or(z.literal("")),
    weeklySummaryEnabled: z.boolean(),
    weeklySummaryDay: z.coerce.number().int().min(0).max(6),
    weeklySummaryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM."),
    inactivityNudgeEnabled: z.boolean(),
    inactivityNudgeDays: z.coerce.number().int("Escribe un número entero.").min(1, "Mínimo 1 día.").max(60, "Máximo 60 días."),
    inactivityNudgeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM."),
    inactivityNudgeSubject: z.string().trim().min(1, "Escribe un título.").max(150),
    inactivityNudgeTemplate: z.string().trim().min(1, "Escribe el mensaje.").max(600),
  })
  .refine((v) => !v.heroEnabled || v.heroTitle.length > 0, {
    message: "Si activas la portada, escribe un título.",
    path: ["heroTitle"],
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
    greetingTemplate: formData.get("greetingTemplate"),
    sendTime: formData.get("sendTime"),
    autoSend: formData.get("autoSend") === "on",
    reminderEnabled: formData.get("reminderEnabled") === "on",
    lockResponsesAfterSend: formData.get("lockResponsesAfterSend") === "on",
    fromName: formData.get("fromName"),
    fromEmail: formData.get("fromEmail"),
    heroEnabled: formData.get("heroEnabled") === "on",
    heroTitle: formData.get("heroTitle"),
    heroParagraph: formData.get("heroParagraph"),
    heroImageUrl: formData.get("heroImageUrl"),
    heroLinkUrl: formData.get("heroLinkUrl"),
    heroLinkText: formData.get("heroLinkText"),
    weeklySummaryEnabled: formData.get("weeklySummaryEnabled") === "on",
    weeklySummaryDay: formData.get("weeklySummaryDay"),
    weeklySummaryTime: formData.get("weeklySummaryTime"),
    inactivityNudgeEnabled: formData.get("inactivityNudgeEnabled") === "on",
    inactivityNudgeDays: formData.get("inactivityNudgeDays"),
    inactivityNudgeTime: formData.get("inactivityNudgeTime"),
    inactivityNudgeSubject: formData.get("inactivityNudgeSubject"),
    inactivityNudgeTemplate: formData.get("inactivityNudgeTemplate"),
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
