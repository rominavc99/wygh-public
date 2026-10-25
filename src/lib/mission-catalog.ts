import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Catálogo de misiones (Mission): lo comparten /admin/misiones y
// /api/v1/admin/missions/catalog.

export const missionTextSchema = z
  .string()
  .trim()
  .min(1, "Escribe la misión.")
  .max(300, "Máximo 300 caracteres.")
  .refine((text) => text.includes("{usuario}"), "Incluye {usuario} donde va el nombre de la persona.");

export type CatalogResult = { ok: true; id: string } | { ok: false; error: string };

export async function createCatalogMission(text: unknown, requiresPhoto: boolean): Promise<CatalogResult> {
  const parsed = missionTextSchema.safeParse(text);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Misión inválida." };
  const mission = await prisma.mission.create({ data: { text: parsed.data, requiresPhoto } });
  return { ok: true, id: mission.id };
}

export async function updateCatalogMission(
  id: string,
  changes: { text?: unknown; requiresPhoto?: boolean; active?: boolean }
): Promise<CatalogResult> {
  const data: { text?: string; requiresPhoto?: boolean; active?: boolean } = {};
  if (changes.text !== undefined) {
    const parsed = missionTextSchema.safeParse(changes.text);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Misión inválida." };
    data.text = parsed.data;
  }
  if (changes.requiresPhoto !== undefined) data.requiresPhoto = changes.requiresPhoto;
  if (changes.active !== undefined) data.active = changes.active;
  const { count } = await prisma.mission.updateMany({ where: { id }, data });
  return count ? { ok: true, id } : { ok: false, error: "Esa misión ya no existe." };
}

/** Solo se borra si nunca se ofreció; si ya se usó, se desactiva para no perder el historial. */
export async function deleteCatalogMission(id: string): Promise<"deleted" | "deactivated"> {
  const used = await prisma.missionAssignment.count({ where: { missionId: id } });
  if (used) {
    await prisma.mission.updateMany({ where: { id }, data: { active: false } });
    return "deactivated";
  }
  await prisma.mission.deleteMany({ where: { id } });
  return "deleted";
}
