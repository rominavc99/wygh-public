"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { sendBirthdayNewsletter, type BirthdaySendResult } from "@/lib/send-birthday";
import { rerollBirthdayPhoto, setManualBirthdayPhoto } from "@/lib/birthday-newsletter";

const birthdaySettingsSchema = z.object({
  birthdayEnabled: z.boolean(),
  birthdaySendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM."),
  birthdayGreetingTemplate: z
    .string()
    .trim()
    .min(1, "Escribe un saludo.")
    .max(300)
    .refine((v) => v.includes("{nombre}"), 'El saludo debe incluir el marcador "{nombre}".'),
  birthdayHeroTitle: z.string().trim().min(1, "Escribe un título.").max(140),
  birthdayHeroParagraph: z.string().trim().max(600),
  birthdayTopTitle: z.string().trim().min(1, "Escribe un título para la sección.").max(140),
});

export type BirthdaySettingsFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> };

export async function updateBirthdaySettings(
  _prevState: BirthdaySettingsFormState,
  formData: FormData
): Promise<BirthdaySettingsFormState> {
  await requireAdmin();

  const parsed = birthdaySettingsSchema.safeParse({
    birthdayEnabled: formData.get("birthdayEnabled") === "on",
    birthdaySendTime: formData.get("birthdaySendTime"),
    birthdayGreetingTemplate: formData.get("birthdayGreetingTemplate"),
    birthdayHeroTitle: formData.get("birthdayHeroTitle"),
    birthdayHeroParagraph: formData.get("birthdayHeroParagraph"),
    birthdayTopTitle: formData.get("birthdayTopTitle"),
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

  revalidatePath("/admin/cumpleanos");
  return { status: "success" };
}

export async function sendBirthdayNow(userId: string, date: string, force: boolean): Promise<BirthdaySendResult> {
  await requireAdmin();
  const result = await sendBirthdayNewsletter(userId, date, { force });
  revalidatePath("/admin/cumpleanos");
  return result;
}

export async function rerollBirthdayPhotoAction(userId: string, date: string) {
  await requireAdmin();
  await rerollBirthdayPhoto(userId, date);
  revalidatePath("/admin/cumpleanos");
}

export async function setManualBirthdayPhotoAction(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("userId");
  const date = formData.get("date");
  const heroPhotoId = formData.get("heroPhotoId");
  if (typeof userId !== "string" || !userId || typeof date !== "string" || !date) return;
  await setManualBirthdayPhoto(userId, date, typeof heroPhotoId === "string" && heroPhotoId ? heroPhotoId : null);
  revalidatePath("/admin/cumpleanos");
}
