import { addComment } from "@/lib/interactions";
import { ApiError, handler, json, readJson, requireApiUser, str } from "@/lib/api/http";
import { commentForm, commentWithExtras } from "@/lib/api/interactions";

/**
 * POST /api/v1/responses/<id>/comments { groupId, text, photo?, replyToId?, mentionIds? }
 * — comenta la respuesta en ese grupo (texto, foto o los dos). replyToId
 * responde a un comentario del mismo hilo; mentionIds etiqueta (solo cuenta
 * si su "@Nombre" está en el texto). Responde el comentario creado.
 */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/responses/[id]/comments">) => {
  const user = await requireApiUser(request);
  const { id } = await ctx.params;
  const body = await readJson(request);
  const result = await addComment(user, id, str(body.groupId), null, commentForm(body));
  if (result.status === "error") throw new ApiError(400, "invalid_comment", result.message);
  return json(await commentWithExtras(result.id!, user.id), 201);
});
