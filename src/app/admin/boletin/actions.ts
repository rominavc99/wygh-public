"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { sendDailyNewsletter, type SendResult } from "@/lib/send-newsletter";
import { syncHeroPhotos, rerollHeroPhoto, setManualHeroPhoto } from "@/lib/hero-photos";
import { rerollPhrase } from "@/lib/phrases";

export async function sendNewsletterNow(date: string, force: boolean): Promise<SendResult> {
  await requireAdmin();
  const result = await sendDailyNewsletter(date, { force });
  revalidatePath("/admin/boletin");
  revalidatePath("/admin/envios");
  revalidatePath("/boletines");
  return result;
}

function revalidateBoletin() {
  revalidatePath("/admin/boletin");
  revalidatePath("/boletines");
}

export async function rerollPhotoAction(date: string) {
  await requireAdmin();
  const photos = await syncHeroPhotos();
  await rerollHeroPhoto(date, photos);
  revalidateBoletin();
}

export async function rerollPhraseAction(date: string) {
  await requireAdmin();
  await rerollPhrase(date);
  revalidateBoletin();
}

export async function setManualPhotoAction(formData: FormData) {
  await requireAdmin();
  const date = formData.get("date");
  const heroPhotoId = formData.get("heroPhotoId");
  if (typeof date !== "string" || !date) return;
  await setManualHeroPhoto(date, typeof heroPhotoId === "string" && heroPhotoId ? heroPhotoId : null);
  revalidateBoletin();
}
