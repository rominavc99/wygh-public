import { prisma } from "@/lib/prisma";
import { handler, json, notFound, requireApiUser } from "@/lib/api/http";

/**
 * DELETE /api/v1/me/groups/<groupId> — salirse del grupo. Sus respuestas,
 * comentarios y reacciones ahí se quedan; volver requiere el enlace de
 * invitación o que un admin la agregue.
 */
export const DELETE = handler(async (request: Request, ctx: RouteContext<"/api/v1/me/groups/[groupId]">) => {
  const user = await requireApiUser(request);
  const { groupId } = await ctx.params;
  const { count } = await prisma.groupMember.deleteMany({ where: { groupId, userId: user.id } });
  if (!count) throw notFound("No estás en ese grupo.");
  return json({ ok: true });
});
