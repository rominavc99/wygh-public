import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateScheduledCommunication } from "@/app/admin/comunicaciones/actions";
import { conflict, handler, json, notFound, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf } from "@/lib/api/admin";
import { communicationDto, communicationFields } from "@/lib/api/admin-communications";

async function load(id: string) {
  const c = await prisma.communication.findUnique({ where: { id }, include: { createdBy: true } });
  if (!c) throw notFound();
  return c;
}

/** GET /api/v1/admin/communications/<id> — un comunicado con su contenido. */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/communications/[id]">) => {
  await requireApiAdmin(request);
  return json(communicationDto(await load((await ctx.params).id), true));
});

/** PATCH /api/v1/admin/communications/<id> — edita uno programado (mismos campos que al crearlo; sin scheduledAt se manda ya). */
export const PATCH = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/communications/[id]">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  const current = communicationDto(await load(id), true);
  const body = { ...current, ...(await readJson(request)) };
  checkState(await updateScheduledCommunication(id, IDLE, formOf(communicationFields(body))));
  return json(communicationDto(await load(id), true));
});

/** DELETE /api/v1/admin/communications/<id> — cancela uno programado (uno ya enviado no se puede borrar). */
export const DELETE = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/communications/[id]">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  const { count } = await prisma.communication.deleteMany({ where: { id, status: "scheduled" } });
  if (!count) throw conflict("Solo se pueden cancelar comunicados programados que todavía no salen.");
  revalidatePath("/admin/comunicaciones");
  return json({ ok: true });
});
