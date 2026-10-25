import Link from "next/link";
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
  userId: string;
  user: { name: string; username: string | null };
  format: string;
  didToday: string | null;
  wentWhere: string | null;
  bestPart: string | null;
  worstPart: string | null;
  tomorrowPlan: string | null;
  mood: string | null;
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
    photoFilename: string | null;
    editedAt: Date | null;
    parentId: string | null;
    userId: string;
    user: { name: string; username: string | null };
    reactions: ReactionRow[];
    mentions: { user: { name: string; username: string | null } }[];
  }[];
};

type CommentRow = ResponseWithExtras["comments"][number];

/** Comentarios de la base al formato del hilo (CommentThread). */
export function toCommentSummaries(rows: CommentRow[], currentUserId: string): CommentSummary[] {
  return rows.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    authorId: c.userId,
    authorName: displayName(c.user),
    text: c.text,
    photoFilename: c.photoFilename,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    reactions: summarizeReactions(c.reactions, currentUserId),
    mentions: c.mentions.map((m) => displayName(m.user)),
  }));
}

export function ResponseCard({
  response,
  groupId,
  currentUserId,
  mentionable,
  compact = false,
}: {
  response: ResponseWithExtras;
  /** Resumen del día plegado: solo estado y la primera línea, con "Ver resumen completo". */
  compact?: boolean;
  /** Grupo en el que se está viendo: reacciones y comentarios son de ese grupo. */
  groupId: string;
  currentUserId: string;
  mentionable: { id: string; name: string }[];
}) {
  const r = response;
  const name = displayName(r.user);

  const comments = toCommentSummaries(r.comments, currentUserId);

  return (
    <li className="flex items-start gap-3">
      <Link href={`/perfil/${r.userId}`} aria-label={`Perfil de ${name}`} className="avatar no-underline" style={{ background: avatarGradient(name) }}>
        {name.charAt(0).toUpperCase()}
      </Link>
      <div className="bubble min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Link href={`/perfil/${r.userId}`} className="bubble-name !mb-0 no-underline hover:underline">
            {name}
          </Link>
          {r.format === "DAY" && r.mood ? <span className="chip chip-neutral text-[11px]">{r.mood}</span> : null}
        </div>

        {r.format === "DAY" ? (
          compact ? (
            <details className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="block truncate group-open:hidden">
                  <strong className="text-ink">Hizo: </strong>
                  {r.didToday}
                </span>
                <span className="mt-1 inline-flex min-h-8 items-center text-xs font-bold text-chrome-4 group-open:hidden">
                  Ver resumen completo ▾
                </span>
              </summary>
              <DayDetails r={r} />
            </details>
          ) : (
            <DayDetails r={r} />
          )
        ) : (
          <HomeDetails r={r} />
        )}

        <ReactionBar target={{ type: "response", id: r.id, groupId }} reactions={summarizeReactions(r.reactions, currentUserId)} />
        <CommentThread
          responseId={r.id}
          groupId={groupId}
          comments={comments}
          currentUserId={currentUserId}
          mentionable={mentionable}
        />
      </div>
    </li>
  );
}

/** Resumen del día completo, más nota, foto y frase. */
function DayDetails({ r }: { r: ResponseWithExtras }) {
  return (
    <>
      <p>
        <strong className="text-ink">Hizo: </strong>
        {r.didToday}
      </p>
      <p>
        {r.atHome ? (
          <strong className="text-ink">Se quedó en casa.</strong>
        ) : (
          <>
            <strong className="text-ink">Fue a: </strong>
            {r.wentWhere}
          </>
        )}
      </p>
      {r.food ? (
        <p>
          <strong className="text-ink">Comió: </strong>
          {r.food}
        </p>
      ) : null}
      {r.bestPart ? (
        <p>
          <strong className="text-ink">Lo mejor: </strong>
          {r.bestPart}
        </p>
      ) : null}
      {r.worstPart ? (
        <p>
          <strong className="text-ink">Lo peor: </strong>
          {r.worstPart}
        </p>
      ) : null}
      {r.tomorrowPlan ? (
        <p>
          <strong className="text-ink">Después: </strong>
          {r.tomorrowPlan}
        </p>
      ) : null}
      <Extras r={r} />
    </>
  );
}

/** Respuesta del formato anterior ("¿Qué harás al llegar a tu casa?"). */
function HomeDetails({ r }: { r: ResponseWithExtras }) {
  const isOnTime = r.atHome && !r.stayedHome && !r.arrivingLate;
  return (
    <>
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
      <Extras r={r} />
    </>
  );
}

/** Nota, foto y frase: iguales en los dos formatos. */
function Extras({ r }: { r: ResponseWithExtras }) {
  return (
    <>
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
    </>
  );
}
