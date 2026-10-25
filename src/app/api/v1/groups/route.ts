import { prisma } from "@/lib/prisma";
import { handler, json, requireApiUser } from "@/lib/api/http";

/**
 * GET /api/v1/groups — los grupos cuyo archivo puede ver: los suyos
 * (también en pausa) o, si es admin, todos.
 */
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  const groups = await prisma.group.findMany({
    where: user.role === "ADMIN" ? {} : { members: { some: { userId: user.id } } },
    select: { id: true, name: true, tagline: true, suspended: true, sendTime: true, members: { where: { userId: user.id }, select: { userId: true } } },
    orderBy: { name: "asc" },
  });
  return json({ groups: groups.map(({ members, ...g }) => ({ ...g, member: members.length > 0 })) });
});
