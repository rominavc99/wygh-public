import { updateHeroPhoto } from "@/app/admin/fotos/actions";
import { prisma } from "@/lib/prisma";
import { handler, json, notFound, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf, overlay } from "@/lib/api/admin";

/** PATCH /api/v1/admin/photos/<id> { description?, date? ("YYYY-MM-DD" o "") } — pie de foto y fecha "programada" de la portada. */
export const PATCH = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/photos/[id]">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  const photo = await prisma.heroPhoto.findUnique({ where: { id } });
  if (!photo) throw notFound();
  const merged = overlay({ description: photo.description ?? "", date: photo.date ?? "" }, await readJson(request), ["description", "date"]);
  checkState(await updateHeroPhoto(IDLE, formOf({ id, ...merged })));
  return json({ ok: true });
});
