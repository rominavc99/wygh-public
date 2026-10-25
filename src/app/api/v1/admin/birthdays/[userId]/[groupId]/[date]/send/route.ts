import { sendBirthdayNow } from "@/app/admin/cumpleanos/actions";
import { handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { checkDate } from "@/lib/api/admin";

/** POST /api/v1/admin/birthdays/<userId>/<groupId>/<date>/send { force? } — manda la edición de cumpleaños ya (force la reenvía). */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/birthdays/[userId]/[groupId]/[date]/send">) => {
  await requireApiAdmin(request);
  const { userId, groupId, date } = await ctx.params;
  checkDate(date);
  const body = await readJson(request).catch(() => ({}) as Record<string, unknown>);
  return json(await sendBirthdayNow(userId, groupId, date, body.force === true));
});
