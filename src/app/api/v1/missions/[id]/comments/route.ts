import { prisma } from "@/lib/prisma";
import { addComment } from "@/lib/interactions";
import { ApiError, handler, json, notFound, readJson, requireApiUser, str } from "@/lib/api/http";
import { commentForm, commentWithExtras } from "@/lib/api/interactions";

/** POST /api/v1/missions/<id>/comments { groupId, text, photo?, replyToId?, mentionIds? } — comenta una misión cumplida (su propio hilo). */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/missions/[id]/comments">) => {
  const user = await requireApiUser(request);
  const { id } = await ctx.params;
  const mission = await prisma.missionAssignment.findUnique({ where: { id }, select: { responseId: true } });
  if (!mission?.responseId) throw notFound("Esa misión no está cumplida.");
  const body = await readJson(request);
  const result = await addComment(user, mission.responseId, str(body.groupId), id, commentForm(body));
  if (result.status === "error") throw new ApiError(400, "invalid_comment", result.message);
  return json(await commentWithExtras(result.id!, user.id), 201);
});
