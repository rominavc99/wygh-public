import { setManualPhotoAction } from "@/app/admin/boletin/actions";
import { handler, json, readJson, requireApiAdmin, str } from "@/lib/api/http";
import { checkDate, formOf } from "@/lib/api/admin";

/** PUT /api/v1/admin/groups/<id>/newsletters/<date>/photo { heroPhotoId } — fija la foto de portada (null = volver a la automática). */
export const PUT = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/groups/[id]/newsletters/[date]/photo">) => {
  await requireApiAdmin(request);
  const { id, date } = await ctx.params;
  checkDate(date);
  await setManualPhotoAction(formOf({ groupId: id, date, heroPhotoId: str((await readJson(request)).heroPhotoId) }));
  return json({ ok: true });
});
