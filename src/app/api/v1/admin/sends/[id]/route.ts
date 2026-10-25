import { toggleArchived } from "@/app/admin/envios/actions";
import { badRequest, handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { formOf } from "@/lib/api/admin";

/** PATCH /api/v1/admin/sends/<id> { archived } — archivar un boletín lo quita de /boletines para los miembros. */
export const PATCH = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/sends/[id]">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  const archived = (await readJson(request)).archived;
  if (typeof archived !== "boolean") throw badRequest('"archived" tiene que ser true o false.');
  await toggleArchived(formOf({ id, nextArchived: String(archived) }));
  return json({ ok: true });
});
