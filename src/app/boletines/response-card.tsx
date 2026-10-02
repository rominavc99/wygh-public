import { displayName } from "@/lib/display-name";
import { avatarGradient } from "@/lib/avatar";
import { summarizeReactions } from "@/lib/reactions";
import { ReactionBar } from "./reaction-bar";
import { CommentThread, type CommentSummary } from "./comment-thread";
import { ZoomableImage } from "./photo-lightbox";

type ReactionRow = {
  emoji: string;
  kind: string;
  userId: string;
  createdAt: Date;
  user: { name: string; username: string | null };
};

type ResponseWithExtras = {
  id: string;
  user: { name: string; username: string | null };
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
  reactions: ReactionRow[];
  comments: {
    id: string;
    text: string;
    createdAt: Date;
    user: { name: string; username: string | null };
    reactions: ReactionRow[];
  }[];
};

export function ResponseCard({ response, currentUserId }: { response: ResponseWithExtras; currentUserId: string }) {
  const r = response;
  const name = displayName(r.user);
  const isOnTime = r.atHome && !r.stayedHome && !r.arrivingLate;

  const comments: CommentSummary[] = r.comments.map((c) => ({
    id: c.id,
    authorName: displayName(c.user),
    text: c.text,
    createdAt: c.createdAt.toISOString(),
    reactions: summarizeReactions(c.reactions, currentUserId),
  }));

  return (
    <li className="flex items-start gap-3">
      <div className="avatar" style={{ background: avatarGradient(name) }}>
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="bubble">
        <p className="bubble-name">{name}</p>

        {r.arrivingLate && r.beforeHomePlan ? (
          <p>
            <strong className="text-ink">Antes de llegar: </strong>
            {r.beforeHomePlan}
          </p>
        ) : null}
        <p>
          <strong className="text-ink">
            {r.atHome ? (r.stayedHome ? "Hoy en casa: " : "Al llegar a casa: ") : "Para dónde va: "}
          </strong>
          {r.atHome ? r.homePlan : r.awayPlan}
        </p>
        {r.stayedHome && r.tonightPlan ? (
          <p>
            <strong className="text-ink">Esta noche: </strong>
            {r.tonightPlan}
          </p>
        ) : null}
        <p>
          <strong className="text-ink">Come: </strong>
          {r.food}
        </p>
        {isOnTime ? (
          <p>
            <strong className="text-ink">Sale: </strong>
            {r.goingOut ? `Sí, a ${r.goingOutWhere}` : "No"}
          </p>
        ) : null}
        {r.note ? <p className="bubble-note">&quot;{r.note}&quot;</p> : null}
        {r.photoFilename ? (
          <div className="mt-2 flex items-center gap-2">
            <ZoomableImage
              src={`/${r.photoFilename}`}
              alt={r.photoDescription ?? ""}
              caption={r.photoDescription}
              className="h-16 w-16 rounded-lg border border-panel-edge object-cover"
            />
            {r.photoDescription ? (
              <p className="text-xs italic text-ink-soft">📷 {r.photoDescription}</p>
            ) : null}
          </div>
        ) : null}
        {r.phraseText ? (
          <div className="mt-3 border-t border-panel-edge pt-2">
            <p className="text-xs italic text-ink-soft">
              💭 Mi frase del día es: &quot;{r.phraseText}&quot;
            </p>
          </div>
        ) : null}

        <ReactionBar target={{ type: "response", id: r.id }} reactions={summarizeReactions(r.reactions, currentUserId)} />
        <CommentThread responseId={r.id} comments={comments} />
      </div>
    </li>
  );
}
