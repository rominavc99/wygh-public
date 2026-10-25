import { toggleReaction } from "@/lib/interactions";
import { handler, json, readJson, requireApiUser, str } from "@/lib/api/http";
import { ensureInteractionOk, reactionInput, responseReactions } from "@/lib/api/interactions";

/**
 * POST /api/v1/responses/<id>/reactions { groupId, emoji, kind: "emoji" | "ascii" }
 * — pone la reacción o la quita si ya estaba (toggle). Responde { reactions }.
 */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/responses/[id]/reactions">) => {
  const user = await requireApiUser(request);
  const { id } = await ctx.params;
  const body = await readJson(request);
  const { emoji, kind } = reactionInput(body);
  const groupId = str(body.groupId);
  ensureInteractionOk(await toggleReaction(user, id, groupId, emoji, kind));
  return json(await responseReactions(id, groupId, user.id));
});
