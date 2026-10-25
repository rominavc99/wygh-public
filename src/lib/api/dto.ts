import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { getSiteUrl } from "@/lib/site-url";
import { describedDate } from "@/lib/date";
import { summarizeReactions, type ReactionSummary } from "@/lib/reactions";
import { missionText } from "@/lib/missions";
import { DEFAULT_GREETING_EMOJI } from "@/lib/user-schema";
import { unreadNotificationCount } from "@/lib/notifications";

// Cómo sale cada cosa en la API (ver docs/API.md). Fechas "YYYY-MM-DD" como
// en la base; instantes en ISO 8601. Las fotos traen su URL completa: piden
// sesión, así que la app las carga mandando el mismo "Authorization: Bearer".

type NameRow = { id: string; name: string; username: string | null };

export function photoUrl(filename: string | null | undefined): string | null {
  return filename ? `${getSiteUrl()}/${filename}` : null;
}

export function userRefDto(u: NameRow) {
  return { id: u.id, name: displayName(u) };
}

/** El usuario del token, con lo que la app necesita para arrancar. */
export async function meDto(userId: string) {
  const [u, unread, pendingMissions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { groupMemberships: { include: { group: { select: { id: true, name: true, suspended: true } } }, orderBy: { group: { name: "asc" } } } },
    }),
    unreadNotificationCount(userId),
    prisma.missionAssignment.count({ where: { userId, status: "ACCEPTED" } }),
  ]);
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    displayName: displayName(u),
    email: u.email,
    role: u.role,
    birthday: u.birthday,
    birthdayPromptDismissed: u.birthdayPromptDismissed,
    greetingEmoji: u.greetingEmoji ?? DEFAULT_GREETING_EMOJI,
    missionOptOut: u.missionOptOut,
    missionStrikes: u.missionStrikes,
    missionBanUntil: u.missionBanUntil && u.missionBanUntil > new Date() ? u.missionBanUntil.toISOString() : null,
    groups: u.groupMemberships.map((m) => m.group),
    unreadNotifications: unread,
    pendingMissions,
  };
}

type ReactionRow = Parameters<typeof summarizeReactions>[0][number];

export function reactionsDto(rows: ReactionRow[], viewerId: string): ReactionSummary[] {
  return summarizeReactions(rows, viewerId);
}

type CommentRow = {
  id: string;
  parentId: string | null;
  userId: string;
  user: NameRow;
  text: string;
  photoFilename: string | null;
  createdAt: Date;
  editedAt: Date | null;
  reactions: ReactionRow[];
  mentions: { user: NameRow }[];
};

export function commentDto(c: CommentRow, viewerId: string) {
  return {
    id: c.id,
    parentId: c.parentId,
    author: userRefDto(c.user),
    text: c.text,
    photoUrl: photoUrl(c.photoFilename),
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    mine: c.userId === viewerId,
    reactions: reactionsDto(c.reactions, viewerId),
    mentions: c.mentions.map((m) => userRefDto(m.user)),
  };
}

type ResponseRow = {
  id: string;
  date: string;
  format: string;
  user: NameRow;
  atHome: boolean;
  arrivingLate: boolean;
  beforeHomePlan: string | null;
  stayedHome: boolean;
  homePlan: string | null;
  awayPlan: string | null;
  tonightPlan: string | null;
  food: string;
  goingOut: boolean;
  goingOutWhere: string | null;
  note: string | null;
  photoFilename: string | null;
  photoDescription: string | null;
  phraseText: string | null;
  didToday: string | null;
  wentWhere: string | null;
  bestPart: string | null;
  worstPart: string | null;
  tomorrowPlan: string | null;
  mood: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Una respuesta. `format` dice cuál de `day` / `home` viene lleno: "DAY" es
 * el resumen del día; "HOME" el formato anterior ("¿Qué harás al llegar a
 * tu casa?"), solo de consulta.
 */
export function responseDto(
  r: ResponseRow,
  extras?: { reactions?: ReactionRow[]; comments?: CommentRow[]; viewerId: string }
) {
  const day = r.format === "DAY";
  return {
    id: r.id,
    date: r.date,
    describedDate: describedDate(r),
    format: day ? "DAY" : "HOME",
    author: userRefDto(r.user),
    day: day
      ? {
          didToday: r.didToday,
          stayedHome: r.atHome,
          wentWhere: r.wentWhere,
          food: r.food || null,
          bestPart: r.bestPart,
          worstPart: r.worstPart,
          tomorrowPlan: r.tomorrowPlan,
          mood: r.mood,
        }
      : null,
    home: day
      ? null
      : {
          atHome: r.atHome,
          arrivingLate: r.arrivingLate,
          beforeHomePlan: r.beforeHomePlan,
          stayedHome: r.stayedHome,
          homePlan: r.homePlan,
          awayPlan: r.awayPlan,
          tonightPlan: r.tonightPlan,
          food: r.food,
          goingOut: r.goingOut,
          goingOutWhere: r.goingOutWhere,
        },
    note: r.note,
    photo: r.photoFilename ? { url: photoUrl(r.photoFilename), description: r.photoDescription } : null,
    phrase: r.phraseText,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ...(extras?.reactions ? { reactions: reactionsDto(extras.reactions, extras.viewerId) } : {}),
    ...(extras?.comments ? { comments: extras.comments.map((c) => commentDto(c, extras.viewerId)) } : {}),
  };
}

type MissionRow = {
  id: string;
  date: string;
  mode: string;
  status: string;
  swaps: number;
  resolutionText: string | null;
  photoFilename: string | null;
  createdAt: Date;
  acceptedAt: Date | null;
  closedAt: Date | null;
  mission: { text: string; requiresPhoto: boolean };
  target: NameRow;
  user?: NameRow;
};

/** Una misión (MissionAssignment). `date` = fecha del boletín en cuyo resumen se entrega. */
export function missionDto(m: MissionRow, extras?: { reactions?: ReactionRow[]; comments?: CommentRow[]; viewerId: string }) {
  return {
    id: m.id,
    date: m.date,
    status: m.status,
    mode: m.mode,
    text: missionText(m.mission.text, m.target),
    requiresPhoto: m.mission.requiresPhoto,
    target: userRefDto(m.target),
    ...(m.user ? { user: userRefDto(m.user) } : {}),
    swaps: m.swaps,
    resolutionText: m.resolutionText,
    photoUrl: photoUrl(m.photoFilename),
    createdAt: m.createdAt.toISOString(),
    acceptedAt: m.acceptedAt?.toISOString() ?? null,
    closedAt: m.closedAt?.toISOString() ?? null,
    ...(extras?.reactions ? { reactions: reactionsDto(extras.reactions, extras.viewerId) } : {}),
    ...(extras?.comments ? { comments: extras.comments.map((c) => commentDto(c, extras.viewerId)) } : {}),
  };
}

/** Lo que incluyen las consultas para responseDto/commentDto con reacciones y comentarios de un grupo. */
export function interactionInclude(groupId: string) {
  return {
    user: true,
    reactions: { where: { groupId }, include: { user: true } },
    comments: {
      where: { groupId, missionId: null },
      include: { user: true, reactions: { include: { user: true } }, mentions: { include: { user: true } } },
      orderBy: { createdAt: "asc" as const },
    },
  };
}
