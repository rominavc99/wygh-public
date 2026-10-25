"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import {
  acceptMission,
  cancelMission,
  rejectMission,
  requestMission,
  swapMission,
  type MissionResult,
} from "@/lib/missions";

// Cada acción vuelve a /misiones; si algo no se pudo, con el motivo en
// ?error= para mostrarlo arriba (así funciona sin JavaScript del lado del cliente).

async function finish(result: MissionResult): Promise<never> {
  revalidatePath("/misiones");
  revalidatePath("/");
  redirect(result.ok ? "/misiones" : `/misiones?error=${encodeURIComponent(result.error)}`);
}

async function guard() {
  const user = await requireUser();
  if (!rateLimit(`missions:${user.id}`, 30, 5 * 60 * 1000)) {
    redirect(`/misiones?error=${encodeURIComponent("Demasiados intentos seguidos. Espera un momento.")}`);
  }
  return user;
}

export async function requestRandomMission(): Promise<void> {
  const user = await guard();
  await finish(await requestMission(user.id, "random"));
}

export async function requestChosenMission(formData: FormData): Promise<void> {
  const user = await guard();
  const targetId = String(formData.get("targetId") ?? "");
  if (!targetId) await finish({ ok: false, error: "Elige a la persona." });
  await finish(await requestMission(user.id, "chosen", targetId));
}

function assignmentId(formData: FormData): string {
  return String(formData.get("assignmentId") ?? "");
}

export async function acceptOffer(formData: FormData): Promise<void> {
  const user = await guard();
  await finish(await acceptMission(user.id, assignmentId(formData)));
}

export async function swapOffer(formData: FormData): Promise<void> {
  const user = await guard();
  await finish(await swapMission(user.id, assignmentId(formData)));
}

export async function rejectOffer(formData: FormData): Promise<void> {
  const user = await guard();
  await finish(await rejectMission(user.id, assignmentId(formData)));
}

export async function cancelAccepted(formData: FormData): Promise<void> {
  const user = await guard();
  await finish(await cancelMission(user.id, assignmentId(formData)));
}
