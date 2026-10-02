"use client";

import { useActionState, useState } from "react";
import { addComment, type AddCommentState } from "./actions";
import { ReactionBar, type ReactionSummary } from "./reaction-bar";

export type CommentSummary = {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
  reactions: ReactionSummary[];
};

const initialState: AddCommentState = { status: "idle" };

export function CommentThread({ responseId, comments }: { responseId: string; comments: CommentSummary[] }) {
  const [open, setOpen] = useState(comments.length > 0);
  const boundAction = addComment.bind(null, responseId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

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
          {comments.map((c) => (
            <div key={c.id} className="text-xs">
              <span className="font-bold text-accent-pink-2">{c.authorName}</span>{" "}
              <span className="text-ink-faint">
                {new Date(c.createdAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
              <p className="text-ink">{c.text}</p>
              <ReactionBar target={{ type: "comment", id: c.id }} reactions={c.reactions} compact />
            </div>
          ))}

          <form action={formAction} className="flex items-start gap-2">
            <textarea
              name="text"
              rows={1}
              maxLength={1000}
              placeholder="Escribe un comentario…"
              className="xp-input flex-1 text-xs"
              required
            />
            <button type="submit" disabled={pending} className="xp-btn-secondary shrink-0 text-xs">
              {pending ? "…" : "Enviar"}
            </button>
          </form>
          {state.status === "error" ? <p className="text-xs text-danger">{state.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
