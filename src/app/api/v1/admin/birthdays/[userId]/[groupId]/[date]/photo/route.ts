import { setManualBirthdayPhotoAction } from "@/app/admin/cumpleanos/actions";
import { handler, json, readJson, requireApiAdmin, str } from "@/lib/api/http";
import { checkDate, formOf } from "@/lib/api/admin";

/** PUT /api/v1/admin/birthdays/<userId>/<groupId>/<date>/photo { heroPhotoId } — fija la foto de portada (null = automática). */
export const PUT = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/birthdays/[userId]/[groupId]/[date]/photo">) => {
  await requireApiAdmin(request);
  const { userId, groupId, date } = await ctx.params;
  checkDate(date);
  await setManualBirthdayPhotoAction(formOf({ userId, groupId, date, heroPhotoId: str((await readJson(request)).heroPhotoId) }));
  return json({ ok: true });
});
