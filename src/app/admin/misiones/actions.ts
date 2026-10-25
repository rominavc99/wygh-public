"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";

const missionSchema = z
  .string()
  .trim()
  .min(1, "Escribe la misión.")
  .max(300, "Máximo 300 caracteres.")
  .refine((text) => text.includes("{usuario}"), "Incluye {usuario} donde va el nombre de la persona.");

function fail(message: string): never {
  redirect(`/admin/misiones?vista=catalogo&error=${encodeURIComponent(message)}`);
}

function parseMission(formData: FormData) {
  const parsed = missionSchema.safeParse(formData.get("text"));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Misión inválida.");
  return { text: parsed.data, requiresPhoto: formData.get("requiresPhoto") === "on" };
}

function idOf(formData: FormData): string {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

export async function createMission(formData: FormData) {
  await requireAdmin();
  await prisma.mission.create({ data: parseMission(formData) });
  revalidatePath("/admin/misiones");
  redirect("/admin/misiones?vista=catalogo");
}

export async function updateMission(formData: FormData) {
  await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  await prisma.mission.update({ where: { id }, data: parseMission(formData) });
  revalidatePath("/admin/misiones");
  redirect("/admin/misiones?vista=catalogo");
}

export async function toggleMission(formData: FormData) {
  await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  const mission = await prisma.mission.findUnique({ where: { id }, select: { active: true } });
  if (!mission) return;
  await prisma.mission.update({ where: { id }, data: { active: !mission.active } });
  revalidatePath("/admin/misiones");
}

/** Solo se borra si nunca se ofreció; si ya se usó, se desactiva para no perder el historial. */
export async function deleteMission(formData: FormData) {
  await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  const used = await prisma.missionAssignment.count({ where: { missionId: id } });
  if (used) await prisma.mission.update({ where: { id }, data: { active: false } });
  else await prisma.mission.delete({ where: { id } });
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
