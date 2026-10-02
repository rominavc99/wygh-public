"use client";

import { useActionState } from "react";
import { updateMyBirthday, type BirthdayFormState } from "./actions";

const initialState: BirthdayFormState = { status: "idle" };

export function BirthdayForm({ birthday }: { birthday: string | null }) {
  const [state, formAction, pending] = useActionState(updateMyBirthday, initialState);

  return (
    <form key={birthday ?? "none"} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-ink">🎂 Fecha de nacimiento</label>
        <input name="birthday" type="date" defaultValue={birthday ?? ""} className="xp-input w-fit" />
        <p className="text-xs text-ink-faint">
          El día de tu cumpleaños sale un boletín especial por la mañana para felicitarte. Solo se usan el día
          y el mes. Déjala vacía para quitarla.
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
