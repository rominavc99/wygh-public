import { sendEmailNow } from "@/app/admin/ajustes/actions";
import { MANUAL_EMAIL_KINDS, type ManualEmailKind } from "@/lib/send-now";
import { handler, json, notFound, readJson, requireApiAdmin, str } from "@/lib/api/http";
import { IDLE, checkState, formOf } from "@/lib/api/admin";

/**
 * POST /api/v1/admin/emails/<kind>/send { userId? } — "Enviar ahora" de un correo especial:
 * weekly, nudge, streak, on-this-day, anniversary, wrapped o welcome (este pide userId).
 * Responde { message }.
 */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/emails/[kind]">) => {
  await requireApiAdmin(request);
  const { kind } = await ctx.params;
  if (!MANUAL_EMAIL_KINDS.includes(kind as ManualEmailKind)) throw notFound("Ese correo no existe.");
  const body = await readJson(request).catch(() => ({}) as Record<string, unknown>);
  const state = checkState(await sendEmailNow(kind as ManualEmailKind, IDLE, formOf({ welcomeUserId: str(body.userId) })));
  return json({ message: state.status === "done" ? state.message : null });
});
