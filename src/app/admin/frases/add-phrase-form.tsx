"use client";

import { useActionState, useRef, useEffect } from "react";
import { createPhrase, type PhraseFormState } from "./actions";

const initialState: PhraseFormState = { status: "idle" };

export function AddPhraseForm() {
  const [state, formAction, pending] = useActionState(createPhrase, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-panel-edge bg-panel-2 p-5 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-sm font-bold text-ink">Nueva frase</label>
        <input name="text" className="xp-input" placeholder="Ej: El que se sube se pasea" required />
        {state.status === "error" ? <p className="text-xs text-danger">{state.message}</p> : null}
      </div>
      <button type="submit" disabled={pending} className="xp-btn h-fit">
        {pending ? "Agregando…" : "Agregar +"}
      </button>
    </form>
  );
}
