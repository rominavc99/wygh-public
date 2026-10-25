"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { sendDailyNewsletter, type SendResult } from "@/lib/send-newsletter";
import { syncHeroPhotos, heroPhotosForGroup, rerollHeroPhoto, setManualHeroPhoto } from "@/lib/hero-photos";
import { rerollPhrase } from "@/lib/phrases";

export async function sendNewsletterNow(groupId: string, date: string, force: boolean): Promise<SendResult> {
  await requireAdmin();
  const result = await sendDailyNewsletter(groupId, date, { force });
  revalidatePath("/admin/boletin");
  revalidatePath("/admin/envios");
  revalidatePath("/boletines");
  return result;
}

function revalidateBoletin() {
  revalidatePath("/admin/boletin");
  revalidatePath("/boletines");
}

export async function rerollPhotoAction(groupId: string, date: string) {
  await requireAdmin();
  const photos = await heroPhotosForGroup(groupId, await syncHeroPhotos());
  await rerollHeroPhoto(groupId, date, photos);
  revalidateBoletin();
}

export async function rerollPhraseAction(groupId: string, date: string) {
  await requireAdmin();
  await rerollPhrase(groupId, date);
  revalidateBoletin();
}

export async function setManualPhotoAction(formData: FormData) {
  await requireAdmin();
  const groupId = formData.get("groupId");
  const date = formData.get("date");
  const heroPhotoId = formData.get("heroPhotoId");
  if (typeof groupId !== "string" || !groupId || typeof date !== "string" || !date) return;
  await setManualHeroPhoto(groupId, date, typeof heroPhotoId === "string" && heroPhotoId ? heroPhotoId : null);
  revalidateBoletin();
}
