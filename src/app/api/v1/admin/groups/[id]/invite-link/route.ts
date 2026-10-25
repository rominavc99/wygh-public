import { prisma } from "@/lib/prisma";
import { setInviteLink } from "@/app/admin/grupos/actions";
import { badRequest, handler, json, readJson, requireApiAdmin, str } from "@/lib/api/http";
import { formOf } from "@/lib/api/admin";
import { inviteUrl } from "@/lib/groups";

/**
 * POST /api/v1/admin/groups/<id>/invite-link { mode: "enable" | "regenerate" | "disable" }
 * — enlace para unirse. regenerate invalida el anterior. Responde { inviteUrl }.
 */
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/groups/[id]/invite-link">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  const mode = str((await readJson(request)).mode);
  if (!["enable", "regenerate", "disable"].includes(mode)) throw badRequest('"mode" tiene que ser enable, regenerate o disable.');
  await setInviteLink(formOf({ groupId: id, mode }));
  const group = await prisma.group.findUnique({ where: { id }, select: { inviteToken: true } });
  return json({ inviteUrl: group?.inviteToken ? inviteUrl(group.inviteToken) : null });
});
