import { toggleMissionReaction } from "@/lib/interactions";
import { handler, json, readJson, requireApiUser, str } from "@/lib/api/http";
import { ensureInteractionOk, missionReactions, reactionInput } from "@/lib/api/interactions";

/** POST /api/v1/missions/<id>/reactions { groupId, emoji, kind } — toggle de reacción a una misión cumplida. Responde { reactions }. */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/missions/[id]/reactions">) => {
  const user = await requireApiUser(request);
  const { id } = await ctx.params;
  const body = await readJson(request);
  const { emoji, kind } = reactionInput(body);
  const groupId = str(body.groupId);
  ensureInteractionOk(await toggleMissionReaction(user, id, groupId, emoji, kind));
  return json(await missionReactions(id, groupId, user.id));
});
