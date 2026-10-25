import { removeGroupMember } from "@/app/admin/grupos/actions";
import { handler, json, requireApiAdmin } from "@/lib/api/http";
import { formOf } from "@/lib/api/admin";

/** DELETE /api/v1/admin/groups/<id>/members/<userId> — saca a alguien del grupo. */
export const DELETE = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/groups/[id]/members/[userId]">) => {
  await requireApiAdmin(request);
  const { id, userId } = await ctx.params;
  await removeGroupMember(formOf({ groupId: id, userId }));
  return json({ ok: true });
});
