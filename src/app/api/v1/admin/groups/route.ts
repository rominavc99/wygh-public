import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { groupSettingsDto } from "@/lib/api/admin-groups";

/** GET /api/v1/admin/groups — todos los grupos con sus ajustes y cuántos miembros tienen. */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const groups = await prisma.group.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } });
  return json({ groups: groups.map((g) => ({ ...groupSettingsDto(g), memberCount: g._count.members })) });
});

const nameSchema = z.string().trim().min(1, "Ponle un nombre.").max(60, "Máximo 60 caracteres.");

/** POST /api/v1/admin/groups { name } — crea un grupo (con los ajustes de siempre y el saludo del resumen del día). */
export const POST = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const parsed = nameSchema.safeParse((await readJson(request)).name);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Nombre inválido.", { name: parsed.error.issues[0]?.message ?? "" });
  try {
    const group = await prisma.group.create({
      data: { name: parsed.data, greetingTemplate: "Hola, {nombre}, esto es lo que hicieron tus amigos ayer:" },
    });
    return json(groupSettingsDto(group), 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict("Ya existe un grupo con ese nombre.");
    throw error;
  }
});
