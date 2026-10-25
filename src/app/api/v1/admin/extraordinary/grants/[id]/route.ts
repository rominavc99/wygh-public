import { removeExtraordinaryGrant } from "@/app/admin/ajustes/actions";
import { handler, json, requireApiAdmin } from "@/lib/api/http";
import { formOf } from "@/lib/api/admin";

/** DELETE /api/v1/admin/extraordinary/grants/<id> — quita un permiso que todavía no se usó. */
export const DELETE = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/extraordinary/grants/[id]">) => {
  await requireApiAdmin(request);
  await removeExtraordinaryGrant(formOf({ id: (await ctx.params).id }));
  return json({ ok: true });
});
