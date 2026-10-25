import { revalidatePath } from "next/cache";
import { submitDailyResponse } from "@/lib/save-response";
import { openResponseDate, responseGroupOptions } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { deliverableMissions } from "@/lib/missions";
import { ApiError, badRequest, handler, json, limit, readJson, requireApiUser } from "@/lib/api/http";
import { responseFormFromJson } from "@/lib/api/response-form";

/**
 * PUT /api/v1/today/response — manda (o actualiza) el resumen abierto, con
 * las mismas reglas que el formulario web. Cuerpo JSON:
 *   didToday*, stayedHome* (bool), wentWhere (si stayedHome = false), food,
 *   bestPart, worstPart, tomorrowPlan, note, mood*, phrase,
 *   photo { data, type } (nueva), photoDescription (obligatoria con foto),
 *   removePhoto (bool), groupIds (string[]; sin él, los que ya tenía o todos si es nuevo),
 *   missions: [{ id, text, photo?, removePhoto? }]  (texto vacío = sin entregar;
 *   las misiones que no vengan en la lista se quedan como estaban).
 * Los demás campos que no vengan quedan vacíos (es un reemplazo completo, no un parche).
 * Errores de validación: 400 con `fields` (las de misiones como "mission:<id>:text").
 */
export const PUT = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  limit(`response:${user.id}`, 15, 5 * 60 * 1000);
  const body = await readJson(request);

  // Sin groupIds: los grupos que ya tenía el resumen (o todos, si es nuevo), como en la web.
  const date = await openResponseDate(user.id);
  const existing = await prisma.response.findUnique({ where: { userId_date: { userId: user.id, date } }, select: { id: true } });
  const current = (await responseGroupOptions(user.id, date, existing?.id ?? null)).filter((o) => o.selected).map((o) => o.id);
  const { form, missionIds: sent } = responseFormFromJson(body, current);
  // El formulario web siempre manda todas; aquí las que falten conservan su entrega.
  for (const m of await deliverableMissions(user.id, date)) {
    if (!sent.has(m.id) && m.resolutionText) form.set(`mission:${m.id}:text`, m.resolutionText);
  }

  const result = await submitDailyResponse(user.id, form);
  if (result.status === "error") {
    if (result.fieldErrors) throw badRequest(result.message ?? "Revisa los campos marcados.", result.fieldErrors);
    throw new ApiError(409, "not_allowed", result.message ?? "No se pudo guardar tu resumen.");
  }
  revalidatePath("/");
  revalidatePath("/misiones");
  return json({ ok: true });
});
