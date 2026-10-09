"use client";

import { startTransition, useActionState } from "react";
import { sendEmailNow, type SendNowState } from "./actions";
import type { ManualEmailKind } from "@/lib/send-now";

const initialState: SendNowState = { status: "idle" };

/**
 * Botón "Enviar ahora" dentro del formulario de Ajustes. No envía el
 * formulario (React lo reiniciaría y se perderían los cambios sin
 * guardar): llama la acción directo y manda con lo que ya está guardado.
 * `recipients` es a quién le llegaría hoy; null cuando depende de un
 * selector (la bienvenida).
 */
export function SendNowButton({
  kind,
  label,
  recipients,
  children,
}: {
  kind: ManualEmailKind;
  label: string;
  recipients: string[] | null;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(sendEmailNow.bind(null, kind), initialState);
  const nobody = recipients !== null && recipients.length === 0;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-panel-edge bg-panel p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button
          type="button"
          disabled={pending || nobody}
          className="xp-btn-secondary"
          onClick={(e) => {
            const who = recipients ? `a ${recipients.length} ${recipients.length === 1 ? "persona" : "personas"}:\n${recipients.join(", ")}` : "";
            if (!window.confirm(`¿Enviar "${label}" ahora ${who}?\n\nSe usan los textos guardados; no cambia la programación.`)) return;
            const data = new FormData();
            const select = e.currentTarget.form?.elements.namedItem("welcomeUserId");
            if (select instanceof HTMLSelectElement) data.set("welcomeUserId", select.value);
            startTransition(() => formAction(data));
          }}
        >
          {pending ? "Enviando…" : "📨 Enviar ahora"}
        </button>
      </div>
      {recipients ? (
        <p className="text-xs text-ink-faint">
          {nobody ? "Hoy no le toca a nadie." : `Le llegaría a: ${recipients.join(", ")}.`}
        </p>
      ) : null}
      {state.status === "done" ? (
        <p role="status" className={`text-xs font-bold ${state.ok ? "text-accent-pink-2" : "text-danger"}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
