"use client";

import { useRef, useState, useTransition } from "react";
import { toggleReaction, toggleCommentReaction } from "./actions";
import { EmojiPicker } from "./emoji-picker";
import { Popover } from "./popover";
import { QUICK_EMOJIS, EMOJI_CATEGORIES, ASCII_PICKER } from "@/lib/emoji-data";
import type { ReactionSummary } from "@/lib/reactions";

export type { ReactionSummary };

type PickerView = "quick" | "emoji" | "ascii" | "who" | null;

/** A qué se reacciona: la respuesta completa o un comentario de su hilo. */
export type ReactionTarget = { type: "response" | "comment"; id: string };

export function ReactionBar({
  target,
  reactions,
  compact = false,
}: {
  target: ReactionTarget;
  reactions: ReactionSummary[];
  /** Versión chica para los comentarios. */
  compact?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [view, setView] = useState<PickerView>(null);
  // Optimista: se aplica de inmediato en la UI, sin esperar el roundtrip.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const whoRef = useRef<HTMLButtonElement>(null);

  function react(emoji: string, kind: "emoji" | "ascii") {
    setView(null);
    setPending((p) => ({ ...p, [emoji]: true }));
    startTransition(async () => {
      if (target.type === "response") await toggleReaction(target.id, emoji, kind);
      else await toggleCommentReaction(target.id, emoji, kind);
      setPending((p) => ({ ...p, [emoji]: false }));
    });
  }

  // Solo se muestran como "chip" las reacciones que ya tienen al menos un
  // voto — el resto vive escondida detrás del botón "Reaccionar", como en
  // Facebook: el mensaje solo enseña lo que de verdad se reaccionó.
  const activeReactions = reactions.filter((r) => r.count > 0);

  return (
    <div className={`flex flex-wrap items-center ${compact ? "mt-1 gap-1" : "mt-2 gap-1.5"}`}>
      {activeReactions.map((r) => (
        <ReactionChip
          key={r.emoji}
          reaction={r}
          compact={compact}
          disabled={pending[r.emoji]}
          onToggle={() => react(r.emoji, r.kind)}
        />
      ))}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setView(view === "quick" ? null : "quick")}
        aria-label="Reaccionar"
        title="Reaccionar"
        className={`flex items-center gap-1 rounded-full border border-panel-edge bg-panel-2 font-bold text-ink-soft hover:bg-[var(--bubble-1)] ${
          compact ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
        }`}
      >
        {compact ? "🙂+" : "🙂 Reaccionar"}
      </button>

      {/* En el celular no hay hover: este botón muestra la misma info de
          quién reaccionó con qué, con un toque. */}
      {activeReactions.length ? (
        <button
          ref={whoRef}
          type="button"
          onClick={() => setView(view === "who" ? null : "who")}
          aria-label="Ver quién reaccionó"
          title="Ver quién reaccionó"
          className={`flex items-center rounded-full border border-panel-edge bg-panel-2 text-ink-soft hover:bg-[var(--bubble-1)] ${
            compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
          }`}
        >
          👥
        </button>
      ) : null}

      {view === "who" ? (
        <Popover anchorRef={whoRef} onClose={() => setView(null)} label="Quién reaccionó">
          <WhoReacted reactions={activeReactions} />
        </Popover>
      ) : null}

      {view === "quick" ? (
        <Popover anchorRef={triggerRef} onClose={() => setView(null)} label="Elegir reacción">
          <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-xl border-2 border-panel-edge bg-panel p-1.5 shadow-lg sm:flex-nowrap">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => react(emoji, "emoji")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg hover:scale-125 hover:bg-[var(--bubble-1)]"
              >
                {emoji}
              </button>
            ))}
            <span className="mx-0.5 h-6 w-px bg-panel-edge" />
            <button
              type="button"
              onClick={() => setView("emoji")}
              aria-label="Más emojis"
              title="Más emojis"
              className="flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-[var(--bubble-1)]"
            >
              ➕
            </button>
            <button
              type="button"
              onClick={() => setView("ascii")}
              aria-label="Emoticones de texto"
              title="Emoticones de texto"
              className="flex h-8 items-center justify-center rounded-full px-1.5 font-mono text-[11px] hover:bg-[var(--bubble-1)]"
            >
              ¯\_(ツ)_/¯
            </button>
          </div>
        </Popover>
      ) : null}

      {view === "emoji" ? (
        <EmojiPicker
          categories={EMOJI_CATEGORIES}
          label="Selector de emojis"
          variant="emoji"
          anchorRef={triggerRef}
          onClose={() => setView(null)}
          onSelect={(value) => react(value, "emoji")}
        />
      ) : null}

      {view === "ascii" ? (
        <EmojiPicker
          items={ASCII_PICKER}
          label="Selector de emoticones de texto"
          variant="ascii"
          anchorRef={triggerRef}
          onClose={() => setView(null)}
          onSelect={(value) => react(value, "ascii")}
        />
      ) : null}
    </div>
  );
}

/** Chip de una reacción: clic = sumarse/quitarse; hover = tarjetita con quiénes reaccionaron. */
function ReactionChip({
  reaction: r,
  compact,
  disabled,
  onToggle,
}: {
  reaction: ReactionSummary;
  compact: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [hover, setHover] = useState(false);

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={onToggle}
        // Solo mouse: en pantallas táctiles el "hover" emulado aparecería al
        // tocar para reaccionar; ahí la info está en el botón 👥.
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
        aria-label={`${r.emoji} ${r.count}: ${r.users.join(", ")}`}
        className={`flex items-center gap-1 rounded-full border transition ${
          r.reactedByMe ? "border-accent-pink bg-[var(--bubble-2)]" : "border-panel-edge bg-panel-2 hover:bg-[var(--bubble-1)]"
        } ${compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm"} ${r.kind === "ascii" ? "font-mono text-xs" : ""}`}
      >
        <span>{r.emoji}</span>
        <span className={`font-bold text-ink-soft ${compact ? "text-[11px]" : "text-xs"}`}>{r.count}</span>
      </button>
      {hover ? (
        <Popover anchorRef={ref} onClose={() => setHover(false)} label="Quién reaccionó">
          <div className="pointer-events-none max-w-60 rounded-lg border-2 border-panel-edge bg-panel px-2.5 py-1.5 text-xs shadow-lg">
            <p className={`mb-0.5 font-bold text-ink ${r.kind === "ascii" ? "font-mono" : ""}`}>{r.emoji}</p>
            <p className="text-ink-soft">{r.users.join(", ")}</p>
            <p className="mt-1 text-[10px] text-ink-faint">
              {r.reactedByMe ? "Clic para quitar tu reacción" : "Clic para reaccionar igual"}
            </p>
          </div>
        </Popover>
      ) : null}
    </>
  );
}

function WhoReacted({ reactions }: { reactions: ReactionSummary[] }) {
  return (
    <div className="max-h-64 w-64 overflow-y-auto rounded-xl border-2 border-panel-edge bg-panel p-2 shadow-lg">
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">👥 Quién reaccionó</p>
      <ul className="flex flex-col gap-1.5">
        {reactions.map((r) => (
          <li key={r.emoji} className="flex items-start gap-2 rounded-lg bg-panel-2 px-2 py-1.5 text-xs">
            <span className={`shrink-0 ${r.kind === "ascii" ? "font-mono" : "text-base leading-none"}`}>{r.emoji}</span>
            <span className="text-ink-soft">{r.users.join(", ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
