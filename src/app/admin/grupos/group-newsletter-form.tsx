"use client";

import { useActionState } from "react";
import { updateGroupNewsletter, type GroupNewsletterState } from "./actions";

type GroupNewsletter = {
  id: string;
  tagline: string;
  greetingTemplate: string;
  sendTime: string;
  reminderEnabled: boolean;
  heroEnabled: boolean;
  heroTitle: string;
  heroParagraph: string;
  heroImageUrl: string;
  heroLinkUrl: string;
  heroLinkText: string;
  selectedPhraseId: string;
};

const initialState: GroupNewsletterState = { status: "idle" };

/** Ajustes del boletín de un grupo (antes vivían en /admin/ajustes, uno para todos). */
export function GroupNewsletterForm({
  group,
  phrases,
}: {
  group: GroupNewsletter;
  phrases: { id: string; text: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateGroupNewsletter.bind(null, group.id), initialState);
  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Lema" error={fieldErrors.tagline}>
        <input name="tagline" defaultValue={group.tagline} className="xp-input" />
      </Field>

      <Field
        label="Saludo del boletín"
        error={fieldErrors.greetingTemplate}
        hint='Usa {nombre} donde quieras que aparezca el nombre de cada persona. Ej: "Hola, {nombre}, esto es lo que hicieron tus amigos ayer:"'
      >
        <textarea name="greetingTemplate" defaultValue={group.greetingTemplate} className="xp-textarea" rows={2} required />
      </Field>

      <Field label="Hora de envío (HH:MM, hora local del servidor)" error={fieldErrors.sendTime}>
        <input name="sendTime" type="time" defaultValue={group.sendTime} className="xp-input w-fit" required />
      </Field>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          type="checkbox"
          name="reminderEnabled"
          defaultChecked={group.reminderEnabled}
          className="h-4 w-4 accent-[var(--accent-pink)]"
        />
        ⏰ Recordar a quien no haya respondido (2 horas, 1 hora y 30 minutos antes del envío)
      </label>

      <div className="flex flex-col gap-4 rounded-xl border border-panel-edge bg-panel p-4">
        <div>
          <h4 className="text-sm font-bold text-ink">📰 Portada</h4>
          <p className="text-xs text-ink-faint">
            Sección tipo periódico arriba de las respuestas del día. Si la desactivas o dejas el título vacío, no
            aparece. La foto sale de las del catálogo y de las respuestas de este grupo.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            name="heroEnabled"
            defaultChecked={group.heroEnabled}
            className="h-4 w-4 accent-[var(--accent-pink)]"
          />
          Mostrar portada
        </label>

        <Field label="Título principal" error={fieldErrors.heroTitle}>
          <input name="heroTitle" defaultValue={group.heroTitle} className="xp-input" />
        </Field>

        <Field label="Párrafo (opcional)" error={fieldErrors.heroParagraph}>
          <textarea name="heroParagraph" defaultValue={group.heroParagraph} className="xp-textarea" rows={3} />
        </Field>

        <Field
          label="URL de la foto principal (opcional)"
          error={fieldErrors.heroImageUrl}
          hint="Si la dejas vacía, cada día se elige una foto sola."
        >
          <input name="heroImageUrl" type="url" placeholder="https://…" defaultValue={group.heroImageUrl} className="xp-input" />
        </Field>

        <Field label="Enlace (opcional)" error={fieldErrors.heroLinkUrl} hint="Si lo dejas vacío, la portada no muestra ningún enlace.">
          <input name="heroLinkUrl" type="url" placeholder="https://…" defaultValue={group.heroLinkUrl} className="xp-input" />
        </Field>

        <Field label="Texto del enlace" error={fieldErrors.heroLinkText}>
          <input name="heroLinkText" defaultValue={group.heroLinkText} placeholder="Leer más" className="xp-input" />
        </Field>

        <Field label="Frase del día" hint="Fija una frase para todos los días, o deja que cada día se elija una sola.">
          <select name="selectedPhraseId" defaultValue={group.selectedPhraseId} className="xp-select">
            <option value="">🎲 Una al azar cada día</option>
            {phrases.map((p) => (
              <option key={p.id} value={p.id}>
                📌 {p.text.length > 70 ? `${p.text.slice(0, 67)}…` : p.text}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {state.status === "error" && state.message ? <p className="text-sm text-danger">{state.message}</p> : null}
      {state.status === "success" ? <p className="text-sm font-bold text-accent-pink-2">💾 Ajustes del boletín guardados.</p> : null}

      <button type="submit" disabled={pending} className="xp-btn w-fit">
        {pending ? "Guardando…" : "Guardar boletín"}
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
