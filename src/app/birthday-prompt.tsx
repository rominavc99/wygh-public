"use client";

import { useActionState } from "react";
import { updateMyBirthday, dismissBirthdayPrompt, type BirthdayFormState } from "./perfil/actions";

const initialState: BirthdayFormState = { status: "idle" };

/**
 * Aviso en la página principal para quien todavía no registró su fecha de
 * nacimiento. Desaparece solo al guardarla (revalidatePath("/")) o al
 * elegir "Prefiero no decirlo" (User.birthdayPromptDismissed).
 */
export function BirthdayPrompt() {
  const [state, formAction, pending] = useActionState(updateMyBirthday, initialState);

  return (
    <div className="win mb-5">
      <div className="win-titlebar">
        <span className="win-icon">🎂</span>
        <span className="win-title">Agrega tu fecha de cumpleaños</span>
        <div className="win-btns">
          <div className="win-btn">_</div>
          <div className="win-btn">□</div>
          <form action={dismissBirthdayPrompt} className="contents">
            <button type="submit" className="win-btn close" aria-label="Prefiero no decirlo">
              ×
            </button>
          </form>
        </div>
      </div>
      <div className="win-body flex flex-col gap-3">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input name="birthday" type="date" required className="xp-input w-fit" aria-label="Fecha de nacimiento" />
          <button type="submit" disabled={pending} className="xp-btn">
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button type="submit" formAction={dismissBirthdayPrompt} formNoValidate className="xp-btn-secondary">
            Prefiero no decirlo
          </button>
        </form>
        {state.status === "error" && state.message ? <p className="text-sm text-danger">{state.message}</p> : null}
      </div>
    </div>
  );
}
