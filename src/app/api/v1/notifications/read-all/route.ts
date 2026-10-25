import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { handler, json, requireApiUser } from "@/lib/api/http";

/** POST /api/v1/notifications/read-all — marca todas como leídas. */
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notificaciones");
  return json({ ok: true });
});
