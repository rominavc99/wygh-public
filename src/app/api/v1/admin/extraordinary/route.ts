import { prisma } from "@/lib/prisma";
import { setExtraordinaryEnabled } from "@/app/admin/ajustes/actions";
import { badRequest, handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf } from "@/lib/api/admin";
import { userRefDto } from "@/lib/api/dto";

/** GET /api/v1/admin/extraordinary — si la página de respuestas extraordinarias está habilitada y los permisos dados. */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const [settings, grants] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.extraordinaryGrant.findMany({ orderBy: [{ date: "desc" }], include: { user: true, grantedBy: true }, take: 200 }),
  ]);
  return json({
    enabled: settings.extraordinaryResponsesEnabled,
    grants: grants.map((g) => ({
      id: g.id,
      user: userRefDto(g.user),
      date: g.date,
      grantedBy: g.grantedBy ? userRefDto(g.grantedBy) : null,
      notifiedAt: g.notifiedAt?.toISOString() ?? null,
      usedAt: g.usedAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
    })),
  });
});

/** PATCH /api/v1/admin/extraordinary { enabled } — habilita o apaga la página; al habilitarla avisa a quien ya tenía permiso. */
export const PATCH = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const enabled = (await readJson(request)).enabled;
  if (typeof enabled !== "boolean") throw badRequest('"enabled" tiene que ser true o false.');
  const state = checkState(await setExtraordinaryEnabled(IDLE, formOf({ enabled })));
  return json({ message: state.status === "done" ? state.message : null });
});
