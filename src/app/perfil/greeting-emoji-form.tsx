"use client";

import { useActionState, useState } from "react";
import { updateMyGreetingEmoji, type GreetingEmojiFormState } from "./actions";
import { EMOJI_PICKER } from "@/lib/emoji-data";
import { DEFAULT_GREETING_EMOJI } from "@/lib/user-schema";

const initialState: GreetingEmojiFormState = { status: "idle" };

export function GreetingEmojiForm({ greetingEmoji }: { greetingEmoji: string | null }) {
  const [state, formAction, pending] = useActionState(updateMyGreetingEmoji, initialState);
  const [value, setValue] = useState(greetingEmoji ?? "");

  return (
    <form key={greetingEmoji ?? "none"} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-ink">Emoji del saludo</label>
        <div className="flex items-center gap-2">
          <input
            name="greetingEmoji"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={DEFAULT_GREETING_EMOJI}
            maxLength={32}
            className="xp-input w-16 text-center text-lg"
          />
          <span className="text-sm text-ink-soft">
            Así se verá: <strong className="text-ink">Hola, … {value.trim() || DEFAULT_GREETING_EMOJI}</strong>
          </span>
        </div>
        <div className="grid max-h-40 grid-cols-10 gap-1 overflow-y-auto rounded-lg border border-panel-edge bg-panel-2 p-2">
          {EMOJI_PICKER.map((emoji) => (
            <button
              key={emoji}
              type="button"
              title={emoji}
              aria-pressed={value === emoji}
              onClick={() => setValue(emoji)}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-panel ${
                value === emoji ? "bg-panel ring-2 ring-accent-pink-2" : ""
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-faint">
          Sale al lado de tu nombre en la página principal. Elige uno de la lista o pega cualquier otro. Déjalo
          vacío para volver al {DEFAULT_GREETING_EMOJI}.
        </p>
      </div>

      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm font-bold text-accent-pink-2">💾 Guardado.</p>
      ) : null}

      <button type="submit" disabled={pending} className="xp-btn w-fit">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
