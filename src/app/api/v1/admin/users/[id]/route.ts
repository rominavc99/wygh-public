import { prisma } from "@/lib/prisma";
import { toggleUserActive, updateUser } from "@/app/admin/usuarios/actions";
import { handler, json, notFound, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf, overlay } from "@/lib/api/admin";

/** PATCH /api/v1/admin/users/<id> { name?, email?, role?, username?, active? } — cambia solo lo que venga. */
export const PATCH = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/users/[id]">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound();
  const body = await readJson(request);

  const fields = overlay({ name: user.name, email: user.email, role: user.role as string, username: user.username ?? "" }, body, ["name", "email", "role", "username"]);
  if (["name", "email", "role", "username"].some((k) => k in body)) {
    checkState(await updateUser(IDLE, formOf({ id, ...fields })));
  }
  if (typeof body.active === "boolean") await toggleUserActive(formOf({ id, nextActive: String(body.active) }));
  return json({ ok: true });
});
