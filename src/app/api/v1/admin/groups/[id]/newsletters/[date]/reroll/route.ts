import { rerollPhotoAction, rerollPhraseAction } from "@/app/admin/boletin/actions";
import { badRequest, handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { checkDate } from "@/lib/api/admin";

/** POST /api/v1/admin/groups/<id>/newsletters/<date>/reroll { target: "photo" | "phrase" } — otra foto o frase de portada al azar. */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/groups/[id]/newsletters/[date]/reroll">) => {
  await requireApiAdmin(request);
  const { id, date } = await ctx.params;
  checkDate(date);
  const target = (await readJson(request)).target;
  if (target === "photo") await rerollPhotoAction(id, date);
  else if (target === "phrase") await rerollPhraseAction(id, date);
  else throw badRequest('"target" tiene que ser "photo" o "phrase".');
  return json({ ok: true });
});
