"use client";

import { useActionState, useState } from "react";
import { updateMyProfile, type ProfileFormState } from "./actions";
import { ASCII_PICKER, GREETING_EMOJIS } from "@/lib/emoji-data";
import { DEFAULT_GREETING_EMOJI } from "@/lib/user-schema";

const initialState: ProfileFormState = { status: "idle" };

// Los campos son controlados a propósito: React resetea los no controlados
// después de cada envío, y si algo falla la persona perdería lo que escribió.
export function ProfileForm({
  username,
  birthday,
  greetingEmoji,
}: {
  username: string | null;
  birthday: string | null;
  greetingEmoji: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateMyProfile, initialState);
  const [usernameValue, setUsernameValue] = useState(username ?? "");
  const [birthdayValue, setBirthdayValue] = useState(birthday ?? "");
  const [emojiValue, setEmojiValue] = useState(greetingEmoji ?? "");
  const [tab, setTab] = useState<"emoji" | "ascii">(
    greetingEmoji && ASCII_PICKER.includes(greetingEmoji) ? "ascii" : "emoji"
  );
  const errors = state.status === "error" ? state.errors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-ink">Nombre de usuario</label>
        <input
          name="username"
          value={usernameValue}
          onChange={(e) => setUsernameValue(e.target.value)}
          placeholder="Ej. ElChapulín99"
          maxLength={40}
          className="xp-input"
        />
        <p className="text-xs text-ink-faint">
          Así aparecerás en el boletín en vez de tu nombre. Déjalo vacío para volver a usar tu nombre.
        </p>
        {errors.username ? <p className="text-sm text-danger">{errors.username}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-panel-edge pt-4">
        <label className="text-sm font-bold text-ink">🎂 Fecha de nacimiento</label>
        <input
          name="birthday"
          type="date"
          value={birthdayValue}
          onChange={(e) => setBirthdayValue(e.target.value)}
          className="xp-input w-fit"
        />
        <p className="text-xs text-ink-faint">
          El día de tu cumpleaños sale un boletín especial por la mañana para felicitarte. Solo se usan el día
          y el mes. Déjala vacía para quitarla.
        </p>
        {errors.birthday ? <p className="text-sm text-danger">{errors.birthday}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-panel-edge pt-4">
        <label className="text-sm font-bold text-ink">Emoji del saludo</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="greetingEmoji"
            value={emojiValue}
            onChange={(e) => setEmojiValue(e.target.value)}
            placeholder={DEFAULT_GREETING_EMOJI}
            maxLength={64}
            className="xp-input w-40 text-center text-lg"
          />
          <span className="text-sm text-ink-soft">
            Así se verá: <strong className="text-ink">Hola, … {emojiValue.trim() || DEFAULT_GREETING_EMOJI}</strong>
          </span>
        </div>
        <div className="flex gap-1" role="tablist">
          {(
            [
              ["emoji", "😀 Emojis"],
              ["ascii", "(◕‿◕) Emoticones"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`chip ${tab === value ? "chip-blue" : "chip-neutral"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-panel-edge bg-panel-2 p-2">
          {tab === "emoji" ? (
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
              {GREETING_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  title={emoji}
                  aria-pressed={emojiValue === emoji}
                  onClick={() => setEmojiValue(emoji)}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-panel ${
                    emojiValue === emoji ? "bg-panel ring-2 ring-accent-pink-2" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {ASCII_PICKER.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={emojiValue === item}
                  onClick={() => setEmojiValue(item)}
                  className={`rounded-md border border-panel-edge bg-panel px-2 py-1 font-mono text-xs hover:bg-[var(--bubble-1)] ${
                    emojiValue === item ? "ring-2 ring-accent-pink-2" : ""
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-ink-faint">
          Sale al lado de tu nombre en la página principal. Elige uno de la lista o pega cualquier otro emoji.
          Déjalo vacío para volver al {DEFAULT_GREETING_EMOJI}.
        </p>
        {errors.greetingEmoji ? <p className="text-sm text-danger">{errors.greetingEmoji}</p> : null}
      </div>

      <div className="flex items-center gap-3 border-t border-panel-edge pt-4">
        <button type="submit" disabled={pending} className="xp-btn w-fit">
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {state.status === "success" ? <p className="text-sm font-bold text-accent-pink-2">💾 Guardado.</p> : null}
        {state.status === "error" ? <p className="text-sm text-danger">Revisa los campos marcados.</p> : null}
      </div>
    </form>
  );
}
