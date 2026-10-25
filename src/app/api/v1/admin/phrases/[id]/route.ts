import { deletePhrase } from "@/app/admin/frases/actions";
import { handler, json, requireApiAdmin } from "@/lib/api/http";
import { formOf } from "@/lib/api/admin";

/** DELETE /api/v1/admin/phrases/<id> — borra la frase (los grupos que la tenían fija vuelven a modo aleatorio). */
export const DELETE = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/phrases/[id]">) => {
  await requireApiAdmin(request);
  await deletePhrase(formOf({ id: (await ctx.params).id }));
  return json({ ok: true });
});
