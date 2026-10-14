"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addComment, type AddCommentState } from "./actions";
import { ReactionBar, type ReactionSummary } from "./reaction-bar";

export type CommentSummary = {
  id: string;
  /** Comentario de primer nivel del que cuelga, o null si es de primer nivel. */
  parentId: string | null;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  reactions: ReactionSummary[];
  /** Nombres de las personas etiquetadas, para resaltar su "@Nombre". */
  mentions: string[];
};

type Person = { id: string; name: string };

const initialState: AddCommentState = { status: "idle" };

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Resalta cada "@Nombre" de las personas etiquetadas en el comentario. */
function CommentText({ text, mentions }: { text: string; mentions: string[] }) {
  if (mentions.length === 0) return <p className="whitespace-pre-wrap text-ink">{text}</p>;
  const tokens = [...mentions].sort((a, b) => b.length - a.length).map((name) => `@${name}`);
  const pattern = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <p className="whitespace-pre-wrap text-ink">
      {text.split(pattern).map((part, i) =>
        tokens.includes(part) ? (
          <span key={i} className="rounded bg-[var(--bubble-2)] px-0.5 font-bold text-accent-pink-2">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </p>
  );
}

export function CommentThread({
  responseId,
  comments,
  currentUserId,
  mentionable,
}: {
  responseId: string;
  comments: CommentSummary[];
  currentUserId: string;
  mentionable: Person[];
}) {
  const [open, setOpen] = useState(comments.length > 0);
  const boundAction = addComment.bind(null, responseId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<Person[]>([]);
  const [replyTo, setReplyTo] = useState<CommentSummary | null>(null);
  const [query, setQuery] = useState<{ start: number; value: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Al terminar de enviar sin error, se limpia el cuadro (es controlado, así
  // que el reinicio automático del formulario no lo vacía).
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && state.status === "idle") {
      setText("");
      setMentions([]);
      setReplyTo(null);
      setQuery(null);
    }
    wasPending.current = pending;
  }, [pending, state]);

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  const suggestions = query
    ? mentionable
        .filter((p) => p.id !== currentUserId)
        .filter((p) => normalize(p.name).split(/\s+/).some((word) => word.startsWith(normalize(query.value))) || normalize(p.name).startsWith(normalize(query.value)))
        .slice(0, 6)
    : [];

  /** Busca un "@algo" justo antes del cursor para abrir la lista de personas. */
  function updateQuery(value: string, caret: number) {
    const match = /(^|\s)@([^\s@]{0,30})$/u.exec(value.slice(0, caret));
    if (match) {
      setQuery({ start: caret - match[2].length - 1, value: match[2] });
      setHighlight(0);
    } else {
      setQuery(null);
    }
  }

  function pickPerson(person: Person) {
    if (!query) return;
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? text.length;
    const insert = `@${person.name} `;
    const next = text.slice(0, query.start) + insert + text.slice(caret);
    setText(next);
    setMentions((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]));
    setQuery(null);
    requestAnimationFrame(() => {
      const position = query.start + insert.length;
      textarea?.focus();
      textarea?.setSelectionRange(position, position);
    });
  }

  function startReply(comment: CommentSummary) {
    setOpen(true);
    setReplyTo(comment);
    // Se etiqueta a quien escribió el comentario (salvo que seas tú).
    const author = mentionable.find((p) => p.id === comment.authorId);
    if (author && author.id !== currentUserId && !text.includes(`@${author.name}`)) {
      setText((prev) => `@${author.name} ${prev}`);
      setMentions((prev) => (prev.some((p) => p.id === author.id) ? prev : [...prev, author]));
    }
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }

  const activeMentions = mentions.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id);

  const renderComment = (c: CommentSummary) => (
    <div key={c.id} className="text-xs">
      <span className="font-bold text-accent-pink-2">{c.authorName}</span>{" "}
      <span className="text-ink-faint">
        {new Date(c.createdAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </span>
      <CommentText text={c.text} mentions={c.mentions} />
      <div className="flex flex-wrap items-center gap-2">
        <ReactionBar target={{ type: "comment", id: c.id }} reactions={c.reactions} compact />
        <button
          type="button"
          onClick={() => startReply(c)}
          className="mt-1 text-[11px] font-bold text-ink-soft hover:text-accent-pink-2"
        >
          ↩ Responder
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-bold text-ink-soft hover:text-accent-pink-2"
      >
        💬 {comments.length > 0 ? `${comments.length} comentario${comments.length === 1 ? "" : "s"}` : "Comentar"}
      </button>

      {open ? (
        <div className="mt-2 flex flex-col gap-2 border-l-2 border-panel-edge pl-3">
          {topLevel.map((c) => {
            const replies = repliesOf(c.id);
            return (
              <div key={c.id} className="flex flex-col gap-2">
                {renderComment(c)}
                {replies.length ? (
                  <div className="ml-2 flex flex-col gap-2 border-l-2 border-[var(--bubble-2)] pl-3">{replies.map(renderComment)}</div>
                ) : null}
              </div>
            );
          })}

          <form action={formAction} className="flex flex-col gap-1">
            {replyTo ? (
              <p className="flex items-center gap-2 text-[11px] text-ink-soft">
                ↩ Respondiendo a <strong className="text-ink">{replyTo.authorName}</strong>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="font-bold text-ink-faint hover:text-danger"
                  aria-label="Cancelar respuesta"
                >
                  ✕
                </button>
              </p>
            ) : null}
            <input type="hidden" name="replyToId" value={replyTo?.id ?? ""} />
            <input type="hidden" name="mentions" value={JSON.stringify(activeMentions)} />
            <div className="flex items-start gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  name="text"
                  rows={1}
                  maxLength={1000}
                  value={text}
                  placeholder={replyTo ? "Escribe tu respuesta…" : "Comenta… (@ para etiquetar)"}
                  className="xp-input w-full text-xs"
                  required
                  onChange={(e) => {
                    setText(e.target.value);
                    updateQuery(e.target.value, e.target.selectionStart);
                  }}
                  onClick={(e) => updateQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
                  onBlur={() => setTimeout(() => setQuery(null), 150)}
                  onKeyDown={(e) => {
                    if (!suggestions.length) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlight((h) => (h + 1) % suggestions.length);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
                    } else if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      pickPerson(suggestions[highlight]);
                    } else if (e.key === "Escape") {
                      setQuery(null);
                    }
                  }}
                  aria-autocomplete="list"
                />
                {suggestions.length ? (
                  <ul
                    role="listbox"
                    className="absolute left-0 top-full z-20 mt-1 w-56 max-w-full overflow-hidden rounded-lg border-2 border-panel-edge bg-panel shadow-lg"
                  >
                    {suggestions.map((person, i) => (
                      <li key={person.id} role="option" aria-selected={i === highlight}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickPerson(person)}
                          className={`block w-full px-3 py-1.5 text-left text-xs ${i === highlight ? "bg-[var(--bubble-1)] font-bold" : ""} text-ink hover:bg-[var(--bubble-1)]`}
                        >
                          @{person.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <button type="submit" disabled={pending} className="xp-btn-secondary shrink-0 text-xs">
                {pending ? "…" : "Enviar"}
              </button>
            </div>
          </form>
          {state.status === "error" ? <p className="text-xs text-danger">{state.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
