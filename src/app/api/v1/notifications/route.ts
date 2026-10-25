import { prisma } from "@/lib/prisma";
import { badRequest, handler, json, requireApiUser } from "@/lib/api/http";
import { notificationDto } from "@/lib/api/notifications";

/**
 * GET /api/v1/notifications?limit=50&before=<ISO> — las notificaciones, de
 * la más nueva a la más vieja. Para seguir, `before` = `nextBefore`.
 */
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const before = params.get("before");
  const beforeDate = before ? new Date(before) : null;
  if (beforeDate && Number.isNaN(beforeDate.getTime())) throw badRequest('"before" tiene que ser una fecha ISO.');

  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const page = rows.slice(0, limit);
  return json({
    unread,
    notifications: page.map(notificationDto),
    nextBefore: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
  });
});
