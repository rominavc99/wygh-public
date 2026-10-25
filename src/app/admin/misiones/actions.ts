"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { createCatalogMission, deleteCatalogMission, updateCatalogMission, type CatalogResult } from "@/lib/mission-catalog";

function fail(message: string): never {
  redirect(`/admin/misiones?vista=catalogo&error=${encodeURIComponent(message)}`);
}

function idOf(formData: FormData): string {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

function done(result: CatalogResult): never {
  if (!result.ok) fail(result.error);
  revalidatePath("/admin/misiones");
  redirect("/admin/misiones?vista=catalogo");
}

export async function createMission(formData: FormData) {
  await requireAdmin();
  done(await createCatalogMission(formData.get("text"), formData.get("requiresPhoto") === "on"));
}

export async function updateMission(formData: FormData) {
  await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  done(await updateCatalogMission(id, { text: formData.get("text"), requiresPhoto: formData.get("requiresPhoto") === "on" }));
}

export async function toggleMission(formData: FormData) {
  await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  const mission = await prisma.mission.findUnique({ where: { id }, select: { active: true } });
  if (!mission) return;
  await updateCatalogMission(id, { active: !mission.active });
  revalidatePath("/admin/misiones");
}

/** Solo se borra si nunca se ofreció; si ya se usó, se desactiva para no perder el historial. */
export async function deleteMission(formData: FormData) {
  await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  await deleteCatalogMission(id);
  revalidatePath("/admin/misiones");
}

/** Quita las advertencias y el baneo de alguien. */
export async function clearStrikes(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) return;
  await prisma.user.update({ where: { id: userId }, data: { missionStrikes: 0, missionBanUntil: null } });
  revalidatePath("/admin/misiones");
}
