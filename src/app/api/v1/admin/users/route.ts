import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { lastVisits } from "@/lib/last-seen";
import { createUser } from "@/app/admin/usuarios/actions";
import { handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf } from "@/lib/api/admin";

/** GET /api/v1/admin/users — todas las personas (también desactivadas), con sus grupos y su última visita. */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    include: { groupMemberships: { include: { group: { select: { id: true, name: true } } } } },
  });
  const visits = await lastVisits(users.map((u) => u.id));
  return json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      displayName: displayName(u),
      email: u.email,
      role: u.role,
      active: u.active,
      birthday: u.birthday,
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: visits.get(u.id)?.toISOString() ?? null,
      missionStrikes: u.missionStrikes,
      missionBanUntil: u.missionBanUntil && u.missionBanUntil > new Date() ? u.missionBanUntil.toISOString() : null,
      missionOptOut: u.missionOptOut,
      groups: u.groupMemberships.map((m) => m.group),
    })),
  });
});

/** POST /api/v1/admin/users { name, email, role: "MEMBER" | "ADMIN", username?, groupIds? } — da de alta (y manda la bienvenida si está activa). */
export const POST = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const b = await readJson(request);
  checkState(await createUser(IDLE, formOf({ name: b.name, email: b.email, role: b.role ?? "MEMBER", username: b.username ?? "", groupIds: b.groupIds })));
  const email = String(b.email ?? "").trim().toLowerCase();
  const created = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  return json({ ok: true, id: created.id }, 201);
});
