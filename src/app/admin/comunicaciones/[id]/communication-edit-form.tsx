"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { updateScheduledCommunication, type CommunicationFormState } from "../actions";
import { RichTextEditor } from "../rich-text-editor";
import { RecipientPicker } from "../recipient-picker";

const initialState: CommunicationFormState = { status: "idle" };

export function CommunicationEditForm({
  id,
  users,
  initial,
}: {
  id: string;
  users: { id: string; label: string }[];
  initial: {
    subject: string;
    bodyHtml: string;
    audience: "all" | "selected";
    recipientIds: string[];
    scheduledAt: string;
  };
}) {
  const boundAction = updateScheduledCommunication.bind(null, id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [sendMode, setSendMode] = useState<"now" | "later">("later");
  const router = useRouter();

  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};

  // Al guardar con éxito no hay nada que "limpiar" (no es un alta, es una
  // edición): basta con refrescar los datos del server component — si se
  // mandó "ahora", esta misma página deja de mostrar el formulario y pasa
  // a la vista de solo lectura porque el status ya no es "scheduled".
  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-panel-edge bg-panel-2 p-4">
      <Field label="Asunto" error={fieldErrors.subject}>
        <input name="subject" defaultValue={initial.subject} className="xp-input" maxLength={200} required />
      </Field>

      <RichTextEditor name="bodyHtml" defaultValue={initial.bodyHtml} error={fieldErrors.bodyHtml} />

      <RecipientPicker
        users={users}
        error={fieldErrors.recipientIds}
        initialAudience={initial.audience}
        initialSelected={initial.recipientIds}
      />

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
            <input
              type="datetime-local"
              name="scheduledAt"
              defaultValue={initial.scheduledAt}
              className="xp-input"
              required
            />
          </Field>
        ) : null}
      </div>

      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}

      <button type="submit" disabled={pending} className="xp-btn w-fit">
        {pending ? "Guardando…" : sendMode === "now" ? "Guardar y enviar ahora →" : "Guardar cambios →"}
      </button>
    </form>
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
