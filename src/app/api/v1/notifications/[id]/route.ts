import { prisma } from "@/lib/prisma";
import { handler, json, notFound, requireApiUser } from "@/lib/api/http";
import { notificationDto } from "@/lib/api/notifications";

/**
 * GET /api/v1/notifications/<id> — una notificación (la marca como leída).
 * Si es copia de un correo trae `html` para mostrarlo en un WebView.
 */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/notifications/[id]">) => {
  const user = await requireApiUser(request);
  const { id } = await ctx.params;
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== user.id) throw notFound();
  const updated = n.readAt ? n : await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  return json({ ...notificationDto(updated), html: updated.html || null });
});
