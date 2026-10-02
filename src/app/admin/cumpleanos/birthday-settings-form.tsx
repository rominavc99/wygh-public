"use client";

import { useActionState } from "react";
import { updateBirthdaySettings, type BirthdaySettingsFormState } from "./actions";

type Settings = {
  birthdayEnabled: boolean;
  birthdaySendTime: string;
  birthdayGreetingTemplate: string;
  birthdayHeroTitle: string;
  birthdayHeroParagraph: string;
  birthdayTopTitle: string;
};

const initialState: BirthdaySettingsFormState = { status: "idle" };

export function BirthdaySettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(updateBirthdaySettings, initialState);
  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4 rounded-xl border border-panel-edge bg-panel-2 p-4">
      <div>
        <h3 className="text-base font-bold text-ink">⚙️ Ajustes del boletín de cumpleaños</h3>
        <p className="text-xs text-ink-faint">
          Nombre, lema y remitente son los mismos del boletín diario (Ajustes). En título, párrafo y título del
          top 5, <code>{"{nombre}"}</code> es quien cumple años y <code>{"{NOMBRE}"}</code> lo mismo en mayúsculas.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          type="checkbox"
          name="birthdayEnabled"
          defaultChecked={settings.birthdayEnabled}
          className="h-4 w-4 accent-[var(--accent-pink)]"
        />
        🎂 Envío automático el día de cada cumpleaños
      </label>

      <Field label="Hora de envío (HH:MM, hora local del servidor)" error={fieldErrors.birthdaySendTime}>
        <input
          name="birthdaySendTime"
          type="time"
          defaultValue={settings.birthdaySendTime}
          className="xp-input w-fit"
          required
        />
      </Field>

      <Field label="Título de la portada" error={fieldErrors.birthdayHeroTitle}>
        <input name="birthdayHeroTitle" defaultValue={settings.birthdayHeroTitle} className="xp-input" required />
      </Field>

      <Field label="Descripción de la portada" error={fieldErrors.birthdayHeroParagraph}>
        <textarea
          name="birthdayHeroParagraph"
          defaultValue={settings.birthdayHeroParagraph}
          className="xp-textarea"
          rows={3}
        />
      </Field>

      <Field
        label="Saludo"
        error={fieldErrors.birthdayGreetingTemplate}
        hint="Igual que en el boletín diario: aquí {nombre} es el nombre de cada destinatario."
      >
        <textarea
          name="birthdayGreetingTemplate"
          defaultValue={settings.birthdayGreetingTemplate}
          className="xp-textarea"
          rows={2}
          required
        />
      </Field>

      <Field label="Título de la sección de momentos" error={fieldErrors.birthdayTopTitle}>
        <input name="birthdayTopTitle" defaultValue={settings.birthdayTopTitle} className="xp-input" required />
      </Field>

      {state.status === "error" && state.message ? <p className="text-sm text-danger">{state.message}</p> : null}
      {state.status === "success" ? <p className="text-sm font-bold text-accent-pink-2">💾 Ajustes guardados.</p> : null}

      <button type="submit" disabled={pending} className="xp-btn w-fit">
        {pending ? "Guardando…" : "Guardar ajustes"}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-ink">{label}</label>
      {children}
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
