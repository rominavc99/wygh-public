import { inviteToGroup } from "@/app/admin/grupos/actions";
import { handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf, message } from "@/lib/api/admin";

/** POST /api/v1/admin/groups/<id>/invitations { userIds } — manda por correo la invitación a unirse. */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/groups/[id]/invitations">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  const state = checkState(await inviteToGroup(id, IDLE, formOf({ userIds: (await readJson(request)).userIds })));
  return json({ ok: true, message: message(state) });
});
