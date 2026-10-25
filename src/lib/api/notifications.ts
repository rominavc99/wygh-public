// A qué pantalla de la app lleva una notificación: se deduce de su enlace
// web (Notification.url), que es interno ("/boletines?date=...&grupo=...").

export type NotificationTarget =
  | { type: "newsletter"; groupId: string | null; date: string | null; birthdayUserId: string | null }
  | { type: "today" | "missions" | "profile" | "notification" }
  | { type: "web"; url: string };

export function notificationTarget(url: string, hasHtml: boolean): NotificationTarget {
  if (!url) return hasHtml ? { type: "notification" } : { type: "today" };
  const parsed = new URL(url, "http://local");
  const q = parsed.searchParams;
  switch (parsed.pathname) {
    case "/":
      return { type: "today" };
    case "/boletines":
      return { type: "newsletter", groupId: q.get("grupo"), date: q.get("date"), birthdayUserId: q.get("cumple") };
    case "/misiones":
      return { type: "missions" };
    case "/perfil":
    case "/perfil/ajustes":
      return { type: "profile" };
    default:
      return hasHtml ? { type: "notification" } : { type: "web", url };
  }
}

export function notificationDto(n: { id: string; kind: string; title: string; preview: string; url: string; html: string; createdAt: Date; readAt: Date | null }) {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    preview: n.preview,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
    hasEmail: Boolean(n.html),
    target: notificationTarget(n.url, Boolean(n.html)),
  };
}
