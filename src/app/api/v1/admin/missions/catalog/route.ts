import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createCatalogMission } from "@/lib/mission-catalog";
import { badRequest, handler, json, readJson, requireApiAdmin } from "@/lib/api/http";

/** GET /api/v1/admin/missions/catalog — el catálogo, con cuántas veces se cumplió cada misión. */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const missions = await prisma.mission.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { assignments: { where: { status: "COMPLETED" } } } } },
  });
  return json({
    missions: missions.map((m) => ({
      id: m.id,
      text: m.text,
      requiresPhoto: m.requiresPhoto,
      active: m.active,
      completedCount: m._count.assignments,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

/** POST /api/v1/admin/missions/catalog { text (con {usuario}), requiresPhoto? } — agrega una misión. */
export const POST = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const b = await readJson(request);
  const result = await createCatalogMission(b.text, b.requiresPhoto === true);
  if (!result.ok) throw badRequest(result.error, { text: result.error });
  revalidatePath("/admin/misiones");
  return json({ ok: true, id: result.id }, 201);
});
