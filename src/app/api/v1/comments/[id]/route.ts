import { editComment } from "@/lib/interactions";
import { ApiError, handler, json, readJson, requireApiUser } from "@/lib/api/http";
import { commentForm, commentWithExtras } from "@/lib/api/interactions";

/**
 * PATCH /api/v1/comments/<id> { text, photo?, removePhoto?, mentionIds? } —
 * edita un comentario propio (texto, foto y etiquetas). Responde el comentario.
 */
export const PATCH = handler(async (request: Request, ctx: RouteContext<"/api/v1/comments/[id]">) => {
  const user = await requireApiUser(request);
  const { id } = await ctx.params;
  const result = await editComment(user, id, commentForm(await readJson(request)));
  if (result.status === "error") throw new ApiError(400, "invalid_comment", result.message);
  return json(await commentWithExtras(id, user.id));
});
