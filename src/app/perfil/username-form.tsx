"use client";

import { useActionState } from "react";
import { updateMyUsername, type UsernameFormState } from "./actions";

const initialState: UsernameFormState = { status: "idle" };

export function UsernameForm({ username }: { username: string | null }) {
  const [state, formAction, pending] = useActionState(updateMyUsername, initialState);

  return (
    <form key={username ?? "none"} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-ink">Nombre de usuario</label>
        <input
          name="username"
          defaultValue={username ?? ""}
          placeholder="Ej. ElChapulín99"
          maxLength={40}
          className="xp-input"
        />
        <p className="text-xs text-ink-faint">
          Así aparecerás en el boletín en vez de tu nombre. Déjalo vacío para volver a usar tu nombre.
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
