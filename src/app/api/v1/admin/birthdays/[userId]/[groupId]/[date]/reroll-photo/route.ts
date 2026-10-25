import { rerollBirthdayPhotoAction } from "@/app/admin/cumpleanos/actions";
import { handler, json, requireApiAdmin } from "@/lib/api/http";
import { checkDate } from "@/lib/api/admin";

/** POST /api/v1/admin/birthdays/<userId>/<groupId>/<date>/reroll-photo — otra foto de portada al azar (de las que subió quien cumple). */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/birthdays/[userId]/[groupId]/[date]/reroll-photo">) => {
  await requireApiAdmin(request);
  const { userId, groupId, date } = await ctx.params;
  checkDate(date);
  await rerollBirthdayPhotoAction(userId, groupId, date);
  return json({ ok: true });
});
