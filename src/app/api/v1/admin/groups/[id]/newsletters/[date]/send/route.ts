import { sendNewsletterNow } from "@/app/admin/boletin/actions";
import { handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { checkDate } from "@/lib/api/admin";

/**
 * POST /api/v1/admin/groups/<id>/newsletters/<date>/send { force? } — manda
 * el boletín ya. Sin force, si ya salió responde status "already_sent";
 * con force lo reenvía. Responde { status, recipientCount, responseCount, error? }.
 */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/groups/[id]/newsletters/[date]/send">) => {
  await requireApiAdmin(request);
  const { id, date } = await ctx.params;
  checkDate(date);
  const body = await readJson(request).catch(() => ({}) as Record<string, unknown>);
  return json(await sendNewsletterNow(id, date, body.force === true));
});
