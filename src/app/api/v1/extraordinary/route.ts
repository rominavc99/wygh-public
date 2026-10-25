import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { EXTRAORDINARY_PATH, recentlyUsedGrants, usableGrants } from "@/lib/extraordinary";
import { submitExtraordinaryResponse } from "@/lib/extraordinary-submit";
import { ApiError, badRequest, handler, json, limit, readJson, requireApiUser } from "@/lib/api/http";
import { responseFormFromJson } from "@/lib/api/response-form";
import { activeGroupIdsOf } from "@/lib/groups";

/**
 * GET /api/v1/extraordinary — respuestas extraordinarias: los días pasados
 * para los que el admin le dio permiso (`availableDates`) y si puede elegir
 * cualquier día (`anyPastDay`, solo admins).
 */
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  const [settings, grants, used] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    usableGrants(user.id),
    recentlyUsedGrants(user.id),
  ]);
  return json({
    enabled: settings.extraordinaryResponsesEnabled,
    anyPastDay: user.role === "ADMIN",
    availableDates: settings.extraordinaryResponsesEnabled ? grants.map((g) => g.date) : [],
    recentlyUsedDates: used.map((g) => g.date),
  });
});

/**
 * POST /api/v1/extraordinary { date, ...los mismos campos que PUT /today/response, sin missions }
 * — manda la respuesta de un día pasado (groupIds opcional; sin él, a todos sus grupos activos).
 */
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  limit(`response-extra:${user.id}`, 15, 5 * 60 * 1000);
  const body = await readJson(request);
  const { form } = responseFormFromJson({ ...body, missions: undefined }, await activeGroupIdsOf(user.id));
  const result = await submitExtraordinaryResponse(user, form);
  if (result.status === "error") {
    if (result.fieldErrors) throw badRequest(result.message ?? "Revisa los campos marcados.", result.fieldErrors);
    throw new ApiError(409, "not_allowed", result.message ?? "No se pudo guardar tu respuesta.");
  }
  revalidatePath(EXTRAORDINARY_PATH);
  revalidatePath("/boletines");
  return json({ ok: true }, 201);
});
