"use client";

import { useActionState, useState, startTransition } from "react";
import { createCommunication, type CommunicationFormState } from "./actions";
import { RichTextEditor } from "./rich-text-editor";
import { RecipientPicker } from "./recipient-picker";

const initialState: CommunicationFormState = { status: "idle" };

export function CommunicationForm({ users }: { users: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(createCommunication, initialState);
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);

  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};

  // Tras un envío exitoso se remonta el formulario entero (key distinto):
  // un <form> normal no sabe limpiar el contentEditable del editor de
  // texto enriquecido ni los checkboxes de destinatarios, así que un
  // reset real solo pasa recreando los componentes desde cero. Se ajusta
  // durante el render (no en un efecto) siguiendo el patrón de React para
  // "reaccionar a un cambio de prop": comparar contra el último visto y
  // llamar los setState ahí mismo, sin useEffect.
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") {
      setFormKey((k) => k + 1);
      setSendMode("now");
    }
  }

  // Igual que en response-form.tsx: no se usa <form action={formAction}>
  // para que un error de validación no borre lo ya escrito (React 19
  // resetea el <form> nativo en cada dispatch, sin importar el resultado).
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        key={formKey}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-panel-edge bg-panel-2 p-4"
      >
        <Field label="Asunto" error={fieldErrors.subject}>
          <input name="subject" className="xp-input" maxLength={200} required />
        </Field>

        <RichTextEditor name="bodyHtml" error={fieldErrors.bodyHtml} />

        <RecipientPicker users={users} error={fieldErrors.recipientIds} />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-ink">Envío</label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input
              type="radio"
              name="sendMode"
              value="now"
              checked={sendMode === "now"}
              onChange={() => setSendMode("now")}
            />
            Enviar ahora
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input
              type="radio"
              name="sendMode"
              value="later"
              checked={sendMode === "later"}
              onChange={() => setSendMode("later")}
            />
            Programar para después
          </label>
          {sendMode === "later" ? (
            <Field label="Fecha y hora" error={fieldErrors.scheduledAt}>
              <input type="datetime-local" name="scheduledAt" className="xp-input" required />
            </Field>
          ) : null}
        </div>

        {state.status === "error" && state.message ? (
          <p className="text-sm text-danger">{state.message}</p>
        ) : null}

        <button type="submit" disabled={pending} className="xp-btn w-fit">
          {pending ? "Enviando…" : sendMode === "now" ? "Enviar ahora →" : "Programar envío →"}
        </button>
      </form>

      {state.status === "success" ? (
        <p className="text-sm font-bold text-accent-pink-2">💾 Listo — mira el historial de abajo.</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-ink">{label}</label>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
