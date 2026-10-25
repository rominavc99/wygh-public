import { revalidatePath } from "next/cache";
import { requestMission } from "@/lib/missions";
import { badRequest, handler, json, limit, readJson, requireApiUser, str } from "@/lib/api/http";
import { ensureMissionOk, missionsState } from "@/lib/api/missions-state";

/** GET /api/v1/missions — el día de misiones: contadores, la oferta abierta, las aceptadas, para quién se puede pedir e historial. */
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  return json(await missionsState(user.id));
});

/**
 * POST /api/v1/missions { mode: "random" | "chosen", targetId? } — pide una
 * misión (queda como oferta: luego accept / swap / reject). Responde el
 * estado completo, igual que GET.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  limit(`missions:${user.id}`, 30, 5 * 60 * 1000);
  const body = await readJson(request);
  const mode = str(body.mode);
  if (mode !== "random" && mode !== "chosen") throw badRequest('"mode" tiene que ser "random" o "chosen".');
  if (mode === "chosen" && !str(body.targetId)) throw badRequest("Falta targetId.", { targetId: "Elige a la persona." });
  ensureMissionOk(await requestMission(user.id, mode, str(body.targetId) || undefined));
  revalidatePath("/misiones");
  return json(await missionsState(user.id), 201);
});
