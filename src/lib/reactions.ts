import { displayName } from "@/lib/display-name";

export type ReactionSummary = {
  emoji: string;
  kind: "emoji" | "ascii";
  count: number;
  reactedByMe: boolean;
  /** Nombres a mostrar de quienes reaccionaron, en orden de reacción. */
  users: string[];
};

/**
 * Agrupa las reacciones (de una respuesta o de un comentario) por emoji,
 * con quiénes reaccionaron. Vive fuera de reaction-bar.tsx porque ese es un
 * módulo "use client" y esto se llama desde componentes de servidor.
 */
export function summarizeReactions(
  reactions: { emoji: string; kind: string; userId: string; createdAt: Date; user: { name: string; username: string | null } }[],
  currentUserId: string
): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>();
  for (const reaction of [...reactions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    let summary = byEmoji.get(reaction.emoji);
    if (!summary) {
      summary = {
        emoji: reaction.emoji,
        kind: reaction.kind === "ascii" ? "ascii" : "emoji",
        count: 0,
        reactedByMe: false,
        users: [],
      };
      byEmoji.set(reaction.emoji, summary);
    }
    summary.count += 1;
    summary.users.push(reaction.userId === currentUserId ? "Tú" : displayName(reaction.user));
    if (reaction.userId === currentUserId) summary.reactedByMe = true;
  }
  return [...byEmoji.values()];
}
