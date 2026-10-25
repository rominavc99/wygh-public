import { prisma } from "@/lib/prisma";
import { createCommunication } from "@/app/admin/comunicaciones/actions";
import { handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf } from "@/lib/api/admin";
import { communicationDto, communicationFields } from "@/lib/api/admin-communications";

/** GET /api/v1/admin/communications — comunicados (programados y enviados), del más reciente. */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const rows = await prisma.communication.findMany({ orderBy: { createdAt: "desc" }, include: { createdBy: true }, take: 200 });
  return json({ communications: rows.map((c) => communicationDto(c)) });
});

/**
 * POST /api/v1/admin/communications { subject, bodyHtml, audience: "all" | "selected" | "groups",
 * recipientIds?, groupIds?, scheduledAt? (ISO; sin él se manda ya) } — crea (y manda o programa) un comunicado.
 * bodyHtml admite el HTML del editor del panel (se limpia: negritas, listas, enlaces…).
 */
export const POST = handler(async (request: Request) => {
  await requireApiAdmin(request);
  checkState(await createCommunication(IDLE, formOf(communicationFields(await readJson(request)))));
  return json({ ok: true }, 201);
});
