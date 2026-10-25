import { revalidatePath } from "next/cache";
import { deleteCatalogMission, updateCatalogMission } from "@/lib/mission-catalog";
import { badRequest, handler, json, readJson, requireApiAdmin } from "@/lib/api/http";

/** PATCH /api/v1/admin/missions/catalog/<id> { text?, requiresPhoto?, active? } — edita, activa o desactiva. */
export const PATCH = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/missions/catalog/[id]">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  const b = await readJson(request);
  const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
  const result = await updateCatalogMission(id, { text: b.text, requiresPhoto: bool(b.requiresPhoto), active: bool(b.active) });
  if (!result.ok) throw badRequest(result.error, { text: result.error });
  revalidatePath("/admin/misiones");
  return json({ ok: true });
});

/** DELETE /api/v1/admin/missions/catalog/<id> — la borra si nunca se ofreció; si ya se usó, solo la desactiva. Responde { result }. */
export const DELETE = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/missions/catalog/[id]">) => {
  await requireApiAdmin(request);
  const result = await deleteCatalogMission((await ctx.params).id);
  revalidatePath("/admin/misiones");
  return json({ result });
});
