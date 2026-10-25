import { revalidatePath } from "next/cache";
import { acceptMission, cancelMission, rejectMission, swapMission } from "@/lib/missions";
import { handler, json, limit, notFound, requireApiUser } from "@/lib/api/http";
import { ensureMissionOk, missionsState } from "@/lib/api/missions-state";

const ACTIONS = { accept: acceptMission, swap: swapMission, reject: rejectMission, cancel: cancelMission };

/**
 * POST /api/v1/missions/<id>/accept | swap | reject | cancel — accept, swap
 * ("Cambiar actividad") y reject son sobre la oferta abierta; cancel, sobre
 * una aceptada (sin advertencia, avisa a los admins). Responde el estado
 * completo, igual que GET /api/v1/missions.
 */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/missions/[id]/[action]">) => {
  const user = await requireApiUser(request);
  const { id, action } = await ctx.params;
  const run = ACTIONS[action as keyof typeof ACTIONS];
  if (!run) throw notFound();
  limit(`missions:${user.id}`, 30, 5 * 60 * 1000);
  ensureMissionOk(await run(user.id, id));
  revalidatePath("/misiones");
  revalidatePath("/");
  return json(await missionsState(user.id));
});
