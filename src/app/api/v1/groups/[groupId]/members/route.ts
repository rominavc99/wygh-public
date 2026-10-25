import { prisma } from "@/lib/prisma";
import { handler, json, requireApiUser } from "@/lib/api/http";
import { requireGroupAccess } from "@/lib/api/groups";
import { userRefDto } from "@/lib/api/dto";

/** GET /api/v1/groups/<groupId>/members — miembros activos (para etiquetar con @ y ver perfiles). */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/groups/[groupId]/members">) => {
  const user = await requireApiUser(request);
  const { groupId } = await ctx.params;
  await requireGroupAccess(user, groupId);
  const members = await prisma.user.findMany({
    where: { active: true, groupMemberships: { some: { groupId } } },
    select: { id: true, name: true, username: true },
  });
  return json({ members: members.map(userRefDto).sort((a, b) => a.name.localeCompare(b.name)) });
});
