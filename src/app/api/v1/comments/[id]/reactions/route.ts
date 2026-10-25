import { toggleCommentReaction } from "@/lib/interactions";
import { handler, json, readJson, requireApiUser } from "@/lib/api/http";
import { commentWithExtras, ensureInteractionOk, reactionInput } from "@/lib/api/interactions";

/** POST /api/v1/comments/<id>/reactions { emoji, kind } — toggle de reacción a un comentario. Responde el comentario. */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/comments/[id]/reactions">) => {
  const user = await requireApiUser(request);
  const { id } = await ctx.params;
  const { emoji, kind } = reactionInput(await readJson(request));
  ensureInteractionOk(await toggleCommentReaction(user, id, emoji, kind));
  return json(await commentWithExtras(id, user.id));
});
