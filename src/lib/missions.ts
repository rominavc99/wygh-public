import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { lastVisits } from "@/lib/last-seen";
import { openResponseDate } from "@/lib/groups";
import { formatLocalDate, localDateOf } from "@/lib/date";
import { getSiteUrl } from "@/lib/site-url";
import { fromAddress, sendOne } from "@/lib/send-engagement";
import { recordNotification } from "@/lib/notifications";
import { missionCancelledAdminEmail, missionStrikeEmail } from "@/lib/mission-email";
import type { MissionStatus } from "@/generated/prisma/enums";
import { deleteResponsePhotoFile, photoFromFormData, saveMissionPhoto, validatePhoto } from "@/lib/response-photos";

// Misiones: actividades pequeñas para alguien del grupo que se entregan en
// el resumen del día. El "día" de una misión es la fecha del resumen en el
// que se entrega (MissionAssignment.date = openResponseDate al ofrecerla),
// así que va de la hora de envío del boletín a la siguiente.

/** Misiones aceptadas por día (las canceladas y las incumplidas también cuentan). */
export const MISSIONS_PER_DAY = 3;
/** Ofertas rechazadas por día; después ya no se pueden pedir más ese día. */
export const REJECTIONS_PER_DAY = 3;
/** Veces que se puede "Cambiar actividad" en una misma oferta. */
export const SWAPS_PER_OFFER = 3;
/** Cancelaciones en los últimos 7 días. */
export const CANCELS_PER_WEEK = 2;
/** Advertencias para quedar fuera, y por cuántos días. */
export const STRIKES_TO_BAN = 3;
export const BAN_DAYS = 7;
/** Quien no entra al sitio en tantos días deja de salir como persona de una misión. */
export const RANDOM_SEEN_DAYS = 3;
export const CHOSEN_SEEN_DAYS = 7;

const DAY_MS = 86_400_000;
const USED_STATUSES: MissionStatus[] = ["ACCEPTED", "COMPLETED", "FAILED", "CANCELLED"];

export type MissionMode = "random" | "chosen";
export type MissionResult = { ok: true } | { ok: false; error: string };

/** El texto de la misión con el nombre de la persona en lugar de {usuario}. */
export function missionText(text: string, target: { name: string; username?: string | null }): string {
  return text.replaceAll("{usuario}", displayName(target));
}

function isBanned(user: { missionBanUntil: Date | null }, now = new Date()): boolean {
  return Boolean(user.missionBanUntil && user.missionBanUntil > now);
}

/** Si el baneo de `userId` ya terminó, lo quita y deja las advertencias en 0. */
async function refreshBan(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, missionBanUntil: { lte: new Date() } },
    data: { missionBanUntil: null, missionStrikes: 0 },
  });
}

/**
 * Quiénes pueden salir como persona de una misión de `userId`: activos, en
 * algún grupo activo en común, sin baneo, que no pidieron quedar fuera y
 * que entraron al sitio en los últimos 3 días (al azar) o 7 (elegida).
 */
export async function eligibleTargets(userId: string, mode: MissionMode) {
  const now = new Date();
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: userId },
      active: true,
      missionOptOut: false,
      OR: [{ missionBanUntil: null }, { missionBanUntil: { lte: now } }],
      groupMemberships: {
        some: { group: { suspended: false, members: { some: { userId } } } },
      },
    },
    select: { id: true, name: true, username: true },
    orderBy: { name: "asc" },
  });
  if (candidates.length === 0) return [];
  const visits = await lastVisits(candidates.map((c) => c.id));
  const days = mode === "random" ? RANDOM_SEEN_DAYS : CHOSEN_SEEN_DAYS;
  const since = now.getTime() - days * DAY_MS;
  return candidates.filter((c) => (visits.get(c.id)?.getTime() ?? 0) >= since);
}

const assignmentInclude = {
  mission: { select: { text: true, requiresPhoto: true } },
  target: { select: { id: true, name: true, username: true } },
} as const;

/** Todo lo que necesita la página de Misiones para el día abierto de `userId`. */
export async function missionDay(userId: string) {
  await refreshBan(userId);
  const date = await openResponseDate(userId);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const [user, assignments, cancelsThisWeek] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { missionStrikes: true, missionBanUntil: true, missionOptOut: true },
    }),
    prisma.missionAssignment.findMany({
      where: { userId, date },
      include: assignmentInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.missionAssignment.count({ where: { userId, status: "CANCELLED", closedAt: { gte: weekAgo } } }),
  ]);
  return {
    date,
    strikes: user.missionStrikes,
    bannedUntil: isBanned(user) ? user.missionBanUntil : null,
    used: assignments.filter((a) => USED_STATUSES.includes(a.status)).length,
    rejections: assignments.filter((a) => a.status === "REJECTED").length,
    cancelsThisWeek,
    offer: assignments.find((a) => a.status === "OFFERED") ?? null,
    accepted: assignments.filter((a) => a.status === "ACCEPTED"),
    completed: assignments.filter((a) => a.status === "COMPLETED"),
  };
}

/**
 * Una misión del catálogo al azar, sin repetir (si se puede) las que
 * `userId` ya tuvo para `targetId`, ni `excludeId` (la que se está cambiando).
 */
async function pickMission(userId: string, targetId: string, excludeId?: string) {
  const [missions, used] = await Promise.all([
    prisma.mission.findMany({
      where: { active: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    }),
    prisma.missionAssignment.findMany({
      where: { userId, targetId, status: { not: "REJECTED" } },
      select: { missionId: true },
    }),
  ]);
  if (missions.length === 0) return null;
  const usedIds = new Set(used.map((u) => u.missionId));
  const fresh = missions.filter((m) => !usedIds.has(m.id));
  const pool = fresh.length ? fresh : missions;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Ofrece una misión: con persona al azar o con `targetId` elegido. */
export async function requestMission(userId: string, mode: MissionMode, targetId?: string): Promise<MissionResult> {
  const day = await missionDay(userId);
  if (day.bannedUntil) return { ok: false, error: "Estás fuera de las misiones por ahora." };
  if (day.offer) return { ok: false, error: "Primero acepta o rechaza la misión que tienes enfrente." };
  if (day.used >= MISSIONS_PER_DAY) return { ok: false, error: `Ya llevas ${MISSIONS_PER_DAY} misiones hoy.` };
  if (day.rejections >= REJECTIONS_PER_DAY) return { ok: false, error: "Ya rechazaste muchas por hoy. Vuelve mañana." };

  const targets = await eligibleTargets(userId, mode);
  const target =
    mode === "chosen" ? targets.find((t) => t.id === targetId) : targets[Math.floor(Math.random() * targets.length)];
  if (!target) {
    return {
      ok: false,
      error: mode === "chosen" ? "Esa persona no está disponible para misiones." : "Ahora mismo no hay nadie disponible para una misión.",
    };
  }

  const mission = await pickMission(userId, target.id);
  if (!mission) return { ok: false, error: "Todavía no hay misiones en el catálogo." };

  await prisma.missionAssignment.create({
    data: { missionId: mission.id, userId, targetId: target.id, date: day.date, mode },
  });
  return { ok: true };
}

/** La oferta abierta `assignmentId` de `userId`, si sigue siendo del día abierto. */
async function currentOffer(userId: string, assignmentId: string) {
  const date = await openResponseDate(userId);
  return prisma.missionAssignment.findFirst({ where: { id: assignmentId, userId, status: "OFFERED", date } });
}

/** "Cambiar actividad": misma persona, otra misión. */
export async function swapMission(userId: string, assignmentId: string): Promise<MissionResult> {
  const offer = await currentOffer(userId, assignmentId);
  if (!offer) return { ok: false, error: "Esa misión ya no está disponible." };
  if (offer.swaps >= SWAPS_PER_OFFER) return { ok: false, error: "Ya no puedes cambiar esta misión. Acéptala o recházala." };
  const mission = await pickMission(userId, offer.targetId, offer.missionId);
  if (!mission) return { ok: false, error: "No hay otra misión en el catálogo." };
  await prisma.missionAssignment.update({
    where: { id: offer.id },
    data: { missionId: mission.id, swaps: { increment: 1 } },
  });
  return { ok: true };
}

export async function rejectMission(userId: string, assignmentId: string): Promise<MissionResult> {
  const offer = await currentOffer(userId, assignmentId);
  if (!offer) return { ok: false, error: "Esa misión ya no está disponible." };
  await prisma.missionAssignment.update({ where: { id: offer.id }, data: { status: "REJECTED", closedAt: new Date() } });
  return { ok: true };
}

export async function acceptMission(userId: string, assignmentId: string): Promise<MissionResult> {
  const day = await missionDay(userId);
  if (day.bannedUntil) return { ok: false, error: "Estás fuera de las misiones por ahora." };
  if (day.offer?.id !== assignmentId) return { ok: false, error: "Esa misión ya no está disponible." };
  if (day.used >= MISSIONS_PER_DAY) return { ok: false, error: `Ya llevas ${MISSIONS_PER_DAY} misiones hoy.` };
  await prisma.missionAssignment.update({
    where: { id: assignmentId },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  return { ok: true };
}

/** Cancela una misión aceptada (sin advertencia) y avisa a los admins. */
export async function cancelMission(userId: string, assignmentId: string): Promise<MissionResult> {
  const day = await missionDay(userId);
  const assignment = day.accepted.find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, error: "Esa misión ya no se puede cancelar." };
  if (day.cancelsThisWeek >= CANCELS_PER_WEEK) {
    return { ok: false, error: `Ya cancelaste ${CANCELS_PER_WEEK} misiones esta semana.` };
  }
  await prisma.missionAssignment.update({
    where: { id: assignmentId },
    data: { status: "CANCELLED", closedAt: new Date() },
  });
  await notifyAdminsOfCancel(userId, assignment);
  return { ok: true };
}

async function notifyAdminsOfCancel(
  userId: string,
  assignment: { mission: { text: string }; target: { name: string; username: string | null } }
): Promise<void> {
  try {
    const [user, admins, settings] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.user.findMany({ where: { role: "ADMIN", active: true } }),
      prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    ]);
    const url = `${getSiteUrl()}/admin/misiones`;
    for (const admin of admins) {
      const parts = missionCancelledAdminEmail({
        adminName: displayName(admin),
        who: displayName(user),
        target: displayName(assignment.target),
        mission: missionText(assignment.mission.text, assignment.target),
        url,
      });
      if (await sendOne({ to: admin.email, from: fromAddress(settings), ...parts })) {
        await recordNotification({ userId: admin.id, kind: "admin", title: parts.subject, text: parts.text, html: parts.html });
      }
    }
  } catch (error) {
    console.error("[misiones] No se pudo avisar a los admins de la cancelación:", error);
  }
}

/**
 * Lo llama el worker cada minuto: las misiones cuyo resumen ya cerró (su
 * fecha quedó antes del día abierto de quien la tenía) pasan a incumplidas,
 * con advertencia; las ofertas sin decidir simplemente se descartan.
 */
export async function expireMissions(): Promise<{ failed: number }> {
  const open = await prisma.missionAssignment.findMany({
    where: { status: { in: ["OFFERED", "ACCEPTED"] } },
    include: assignmentInclude,
    orderBy: { createdAt: "asc" },
  });
  const openDates = new Map<string, string>();
  let failed = 0;

  for (const a of open) {
    if (!openDates.has(a.userId)) openDates.set(a.userId, await openResponseDate(a.userId));
    if (a.date >= openDates.get(a.userId)!) continue;

    if (a.status === "OFFERED") {
      await prisma.missionAssignment.update({ where: { id: a.id }, data: { status: "REJECTED", closedAt: new Date() } });
      continue;
    }
    await prisma.missionAssignment.update({ where: { id: a.id }, data: { status: "FAILED", closedAt: new Date() } });
    failed++;
    await addStrike(a.userId, missionText(a.mission.text, a.target));
  }
  return { failed };
}

/** Suma una advertencia (o banea, a la tercera) y se lo avisa por correo y notificación. */
async function addStrike(userId: string, mission: string): Promise<void> {
  await refreshBan(userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  // Ya baneado: la misión queda incumplida pero no suma más.
  if (isBanned(user)) return;

  const strikes = user.missionStrikes + 1;
  const banUntil = strikes >= STRIKES_TO_BAN ? new Date(Date.now() + BAN_DAYS * DAY_MS) : null;
  await prisma.user.update({
    where: { id: userId },
    data: { missionStrikes: strikes, ...(banUntil ? { missionBanUntil: banUntil } : {}) },
  });

  try {
    const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    const parts = missionStrikeEmail({
      name: displayName(user),
      mission,
      strikes,
      maxStrikes: STRIKES_TO_BAN,
      bannedUntil: banUntil ? formatLocalDate(localDateOf(banUntil)) : null,
      url: `${getSiteUrl()}/misiones`,
    });
    if (user.active && (await sendOne({ to: user.email, from: fromAddress(settings), ...parts }))) {
      await recordNotification({ userId, kind: "mission", title: parts.subject, text: parts.text, html: parts.html });
    }
  } catch (error) {
    console.error("[misiones] No se pudo mandar el aviso de advertencia:", error);
  }
}

/** Misiones que `userId` puede entregar (o corregir) en su resumen de `date`. */
export async function deliverableMissions(userId: string, date: string) {
  const rows = await prisma.missionAssignment.findMany({
    where: { userId, date, status: { in: ["ACCEPTED", "COMPLETED"] } },
    include: assignmentInclude,
    orderBy: { acceptedAt: "asc" },
  });
  return rows.map((a) => ({
    id: a.id,
    text: missionText(a.mission.text, a.target),
    requiresPhoto: a.mission.requiresPhoto,
    targetName: displayName(a.target),
    resolutionText: a.resolutionText,
    photoFilename: a.photoFilename,
  }));
}

export type DeliverableMission = Awaited<ReturnType<typeof deliverableMissions>>[number];

/** Nombre de los campos de una misión en el formulario del resumen. */
export function missionField(id: string, field: "text" | "removePhoto" | ""): string {
  return `mission:${id}:${field}`;
}

const RESOLUTION_MAX = 1000;

/**
 * Valida lo que el formulario trae para cada misión entregable de `date` y
 * devuelve los errores (por campo `mission:<id>:text`) y una función que,
 * ya guardada la respuesta, lo aplica: con texto queda cumplida y ligada al
 * resumen; vacía vuelve a aceptada (todavía pendiente).
 */
export async function prepareMissionDeliveries(userId: string, date: string, formData: FormData) {
  const missions = await prisma.missionAssignment.findMany({
    where: { userId, date, status: { in: ["ACCEPTED", "COMPLETED"] } },
    include: { mission: { select: { requiresPhoto: true } } },
  });
  const fieldErrors: Record<string, string> = {};
  const plans: {
    id: string;
    text: string | null;
    photo: ReturnType<typeof photoFromFormData>;
    keptPhoto: string | null;
    oldPhoto: string | null;
  }[] = [];

  for (const m of missions) {
    const key = missionField(m.id, "text");
    const raw = formData.get(key);
    const text = typeof raw === "string" ? raw.trim() : "";
    const photo = photoFromFormData(formData, missionField(m.id, ""));
    const keptPhoto = formData.get(missionField(m.id, "removePhoto")) === "on" ? null : m.photoFilename;
    const hasPhoto = Boolean(photo || keptPhoto);

    if (text.length > RESOLUTION_MAX) fieldErrors[key] = `Máximo ${RESOLUTION_MAX} caracteres.`;
    else if (!text && hasPhoto) fieldErrors[key] = "Cuenta cómo cumpliste la misión.";
    else if (text && m.mission.requiresPhoto && !hasPhoto) fieldErrors[key] = "Esta misión pide una foto.";
    else if (photo) {
      const error = await validatePhoto(photo);
      if (error) fieldErrors[key] = error;
    }
    plans.push({ id: m.id, text: text || null, photo, keptPhoto: text ? keptPhoto : null, oldPhoto: m.photoFilename });
  }

  async function apply(responseId: string): Promise<void> {
    for (const plan of plans) {
      let photoFilename = plan.keptPhoto;
      if (plan.text && plan.photo) photoFilename = await saveMissionPhoto(userId, plan.photo);
      if (plan.oldPhoto && plan.oldPhoto !== photoFilename) await deleteResponsePhotoFile(plan.oldPhoto);
      await prisma.missionAssignment.update({
        where: { id: plan.id },
        data: plan.text
          ? { status: "COMPLETED", resolutionText: plan.text, photoFilename, responseId, closedAt: new Date() }
          : { status: "ACCEPTED", resolutionText: null, photoFilename: null, responseId: null, closedAt: null },
      });
    }
  }

  return { fieldErrors, apply };
}
