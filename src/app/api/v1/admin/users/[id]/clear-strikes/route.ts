import { clearStrikes } from "@/app/admin/misiones/actions";
import { handler, json, requireApiAdmin } from "@/lib/api/http";
import { formOf } from "@/lib/api/admin";

/** POST /api/v1/admin/users/<id>/clear-strikes — quita las advertencias de misiones y el baneo. */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/users/[id]/clear-strikes">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  await clearStrikes(formOf({ userId: id }));
  return json({ ok: true });
});
