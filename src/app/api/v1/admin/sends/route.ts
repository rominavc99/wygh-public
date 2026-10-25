import { prisma } from "@/lib/prisma";
import { handler, json, requireApiAdmin } from "@/lib/api/http";

/** GET /api/v1/admin/sends?groupId=&limit=60 — boletines enviados (también archivados), del más reciente. */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const params = new URL(request.url).searchParams;
  const groupId = params.get("groupId");
  const limit = Math.min(Math.max(Number(params.get("limit")) || 60, 1), 365);
  const sends = await prisma.newsletterSend.findMany({
    where: groupId ? { groupId } : {},
    orderBy: [{ date: "desc" }, { sentAt: "desc" }],
    take: limit,
    include: { group: { select: { name: true } } },
  });
  return json({
    sends: sends.map((s) => ({
      id: s.id,
      groupId: s.groupId,
      groupName: s.group.name,
      date: s.date,
      sentAt: s.sentAt.toISOString(),
      status: s.status,
      error: s.error,
      recipientCount: s.recipientCount,
      responseCount: s.responseCount,
      archived: s.archived,
    })),
  });
});
