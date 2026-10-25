import { prisma } from "@/lib/prisma";
import {
  CANCELS_PER_WEEK,
  MISSIONS_PER_DAY,
  REJECTIONS_PER_DAY,
  STRIKES_TO_BAN,
  SWAPS_PER_OFFER,
  eligibleTargets,
  missionDay,
  type MissionResult,
} from "@/lib/missions";
import { ApiError } from "@/lib/api/http";
import { missionDto, userRefDto } from "@/lib/api/dto";

/** Lo que muestra la pantalla de Misiones (GET /api/v1/missions y la respuesta de cada acción). */
export async function missionsState(userId: string) {
  const [day, targets, history] = await Promise.all([
    missionDay(userId),
    eligibleTargets(userId, "chosen"),
    prisma.missionAssignment.findMany({
      where: { userId, status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
      include: { mission: true, target: true },
      orderBy: { closedAt: "desc" },
      take: 30,
    }),
  ]);
  const left = MISSIONS_PER_DAY - day.used;
  return {
    date: day.date,
    used: day.used,
    perDay: MISSIONS_PER_DAY,
    rejections: day.rejections,
    rejectionsPerDay: REJECTIONS_PER_DAY,
    cancelsThisWeek: day.cancelsThisWeek,
    cancelsPerWeek: CANCELS_PER_WEEK,
    swapsPerOffer: SWAPS_PER_OFFER,
    strikes: day.strikes,
    strikesToBan: STRIKES_TO_BAN,
    bannedUntil: day.bannedUntil?.toISOString() ?? null,
    canRequest: !day.bannedUntil && !day.offer && left > 0 && day.rejections < REJECTIONS_PER_DAY,
    offer: day.offer ? missionDto(day.offer) : null,
    accepted: day.accepted.map((m) => missionDto(m)),
    completed: day.completed.map((m) => missionDto(m)),
    /** Para quién se puede pedir una misión ahora (modo "chosen"). */
    chosenTargets: targets.map(userRefDto),
    history: history.map((m) => missionDto(m)),
  };
}

/** Convierte el resultado de una regla de misiones en 409 si no se pudo. */
export function ensureMissionOk(result: MissionResult): void {
  if (!result.ok) throw new ApiError(409, "mission_not_allowed", result.error);
}
