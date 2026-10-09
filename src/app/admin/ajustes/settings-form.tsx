"use client";

import { useActionState } from "react";
import { WEEKDAY_NAMES } from "@/lib/weekdays";
import { updateSettings, type SettingsFormState } from "./actions";

type Settings = {
  newsletterName: string;
  tagline: string;
  greetingTemplate: string;
  sendTime: string;
  autoSend: boolean;
  reminderEnabled: boolean;
  lockResponsesAfterSend: boolean;
  fromName: string;
  fromEmail: string;
  heroEnabled: boolean;
  heroTitle: string;
  heroParagraph: string;
  heroImageUrl: string;
  heroLinkUrl: string;
  heroLinkText: string;
  weeklySummaryEnabled: boolean;
  weeklySummaryDay: number;
  weeklySummaryTime: string;
  inactivityNudgeEnabled: boolean;
  inactivityNudgeDays: number;
  inactivityNudgeTime: string;
  inactivityNudgeSubject: string;
  inactivityNudgeTemplate: string;
  extrasEmailTime: string;
  streakEmailEnabled: boolean;
  onThisDayEnabled: boolean;
  anniversaryEnabled: boolean;
  wrappedEnabled: boolean;
  welcomeEmailEnabled: boolean;
};

const EXTRA_EMAILS = [
  { name: "streakEmailEnabled", preview: "racha", label: "🔥 Felicitación por racha", hint: "A los 7, 30, 50, 100, 200 y 365 días seguidos respondiendo." },
  { name: "onThisDayEnabled", preview: "hace-un-ano", label: "📅 Hace un año…", hint: "Le recuerda a cada quien lo que respondió ese mismo día el año pasado." },
  { name: "anniversaryEnabled", preview: "aniversario", label: "🎂 Aniversario en el grupo", hint: "Cada año desde que dieron de alta a la persona." },
  { name: "wrappedEnabled", preview: "anual", label: "🎁 Resumen anual", hint: "El 1 de enero, el año anterior de cada quien." },
  { name: "welcomeEmailEnabled", preview: "bienvenida", label: "👋 Bienvenida", hint: "Al dar de alta a alguien en Usuarios (sale en ese momento)." },
] as const;

const initialState: SettingsFormState = { status: "idle" };

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(updateSettings, initialState);
  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="Nombre del boletín" error={fieldErrors.newsletterName}>
        <input name="newsletterName" defaultValue={settings.newsletterName} className="xp-input" required />
      </Field>

      <Field label="Lema" error={fieldErrors.tagline}>
        <input name="tagline" defaultValue={settings.tagline} className="xp-input" />
      </Field>

      <Field
        label="Saludo del boletín"
        error={fieldErrors.greetingTemplate}
        hint='Usa {nombre} donde quieras que aparezca el nombre de cada persona. Ej: "Hola, {nombre}, esto es lo que estarán haciendo tus amigos el día de hoy:"'
      >
        <textarea
          name="greetingTemplate"
          defaultValue={settings.greetingTemplate}
          className="xp-textarea"
          rows={2}
          required
        />
      </Field>

      <Field label="Hora de envío (HH:MM, hora local del servidor)" error={fieldErrors.sendTime}>
        <input name="sendTime" type="time" defaultValue={settings.sendTime} className="xp-input" required />
      </Field>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          type="checkbox"
          name="autoSend"
          defaultChecked={settings.autoSend}
          className="h-4 w-4 accent-[var(--accent-pink)]"
        />
        Envío automático activado
      </label>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          type="checkbox"
          name="reminderEnabled"
          defaultChecked={settings.reminderEnabled}
          className="h-4 w-4 accent-[var(--accent-pink)]"
        />
        ⏰ Recordar a quien no haya respondido (1 hora antes del envío)
      </label>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          type="checkbox"
          name="lockResponsesAfterSend"
          defaultChecked={settings.lockResponsesAfterSend}
          className="h-4 w-4 accent-[var(--accent-pink)]"
        />
        🔒 Bloquear respuestas del día una vez que se envía el boletín
      </label>

      <Field label="Nombre del remitente" error={fieldErrors.fromName}>
        <input name="fromName" defaultValue={settings.fromName} className="xp-input" required />
      </Field>

      <Field label="Correo del remitente" error={fieldErrors.fromEmail}>
        <input name="fromEmail" type="email" defaultValue={settings.fromEmail} className="xp-input" />
      </Field>

      <div className="mt-2 flex flex-col gap-4 rounded-xl border border-panel-edge bg-panel-2 p-4">
        <div>
          <h3 className="text-base font-bold text-ink">📰 Portada del boletín</h3>
          <p className="text-xs text-ink-faint">
            Sección tipo periódico arriba de las respuestas del día. Si la desactivas o
            dejas el título vacío, no aparece.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            name="heroEnabled"
            defaultChecked={settings.heroEnabled}
            className="h-4 w-4 accent-[var(--accent-pink)]"
          />
          Mostrar portada
        </label>

        <Field label="Título principal" error={fieldErrors.heroTitle}>
          <input name="heroTitle" defaultValue={settings.heroTitle} className="xp-input" />
        </Field>

        <Field label="Párrafo (opcional)" error={fieldErrors.heroParagraph}>
          <textarea
            name="heroParagraph"
            defaultValue={settings.heroParagraph}
            className="xp-textarea"
            rows={3}
          />
        </Field>

        <Field
          label="URL de la foto principal (opcional)"
          error={fieldErrors.heroImageUrl}
          hint="Pega el enlace directo a una imagen ya subida a algún lado (ej. imgur, Google Photos con enlace público, etc.)."
        >
          <input
            name="heroImageUrl"
            type="url"
            placeholder="https://…"
            defaultValue={settings.heroImageUrl}
            className="xp-input"
          />
        </Field>

        <Field
          label="Enlace (opcional)"
          error={fieldErrors.heroLinkUrl}
          hint="Si lo dejas vacío, la portada no muestra ningún botón/enlace."
        >
          <input
            name="heroLinkUrl"
            type="url"
            placeholder="https://…"
            defaultValue={settings.heroLinkUrl}
            className="xp-input"
          />
        </Field>

        <Field label="Texto del enlace" error={fieldErrors.heroLinkText}>
          <input
            name="heroLinkText"
            defaultValue={settings.heroLinkText}
            placeholder="Leer más"
            className="xp-input"
          />
        </Field>
      </div>

      <div className="mt-2 flex flex-col gap-4 rounded-xl border border-panel-edge bg-panel-2 p-4">
        <div>
          <h3 className="text-base font-bold text-ink">📊 Resumen semanal</h3>
          <p className="text-xs text-ink-faint">
            Le llega a todo el grupo con la participación de cada quien en los 7 días anteriores. Los
            admins reciben una versión más completa.{" "}
            <a href="/admin/estadisticas/vista-previa?correo=resumen" target="_blank" className="underline">
              Vista previa
            </a>{" "}
            ·{" "}
            <a href="/admin/estadisticas/vista-previa?correo=resumen-admin" target="_blank" className="underline">
              Versión admin
            </a>
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            name="weeklySummaryEnabled"
            defaultChecked={settings.weeklySummaryEnabled}
            className="h-4 w-4 accent-[var(--accent-pink)]"
          />
          Mandar el resumen semanal
        </label>

        <div className="flex flex-wrap gap-4">
          <Field label="Día" error={fieldErrors.weeklySummaryDay}>
            <select name="weeklySummaryDay" defaultValue={settings.weeklySummaryDay} className="xp-input">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_NAMES[day]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hora" error={fieldErrors.weeklySummaryTime}>
            <input
              name="weeklySummaryTime"
              type="time"
              defaultValue={settings.weeklySummaryTime}
              className="xp-input"
              required
            />
          </Field>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-4 rounded-xl border border-panel-edge bg-panel-2 p-4">
        <div>
          <h3 className="text-base font-bold text-ink">🥪 Correo a quien no responde</h3>
          <p className="text-xs text-ink-faint">
            Le llega a quien lleva varios días seguidos sin responder, y se repite cada tantos días
            mientras siga sin responder.{" "}
            <a href="/admin/estadisticas/vista-previa?correo=inactividad" target="_blank" className="underline">
              Vista previa
            </a>
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            name="inactivityNudgeEnabled"
            defaultChecked={settings.inactivityNudgeEnabled}
            className="h-4 w-4 accent-[var(--accent-pink)]"
          />
          Mandar el correo de inactividad
        </label>

        <div className="flex flex-wrap gap-4">
          <Field label="Días seguidos sin responder" error={fieldErrors.inactivityNudgeDays}>
            <input
              name="inactivityNudgeDays"
              type="number"
              min={1}
              max={60}
              defaultValue={settings.inactivityNudgeDays}
              className="xp-input w-28"
              required
            />
          </Field>
          <Field label="Hora" error={fieldErrors.inactivityNudgeTime}>
            <input
              name="inactivityNudgeTime"
              type="time"
              defaultValue={settings.inactivityNudgeTime}
              className="xp-input"
              required
            />
          </Field>
        </div>

        <Field
          label="Título (también es el asunto)"
          error={fieldErrors.inactivityNudgeSubject}
          hint="Puedes usar {nombre} y {dias}."
        >
          <input name="inactivityNudgeSubject" defaultValue={settings.inactivityNudgeSubject} className="xp-input" required />
        </Field>

        <Field label="Mensaje" error={fieldErrors.inactivityNudgeTemplate} hint="Puedes usar {nombre} y {dias}.">
          <textarea
            name="inactivityNudgeTemplate"
            defaultValue={settings.inactivityNudgeTemplate}
            className="xp-textarea"
            rows={3}
            required
          />
        </Field>
      </div>

      <div className="mt-2 flex flex-col gap-4 rounded-xl border border-panel-edge bg-panel-2 p-4">
        <div>
          <h3 className="text-base font-bold text-ink">✨ Correos especiales</h3>
          <p className="text-xs text-ink-faint">Salen a la hora de abajo, salvo la bienvenida.</p>
        </div>

        <Field label="Hora" error={fieldErrors.extrasEmailTime}>
          <input name="extrasEmailTime" type="time" defaultValue={settings.extrasEmailTime} className="xp-input w-fit" required />
        </Field>

        {EXTRA_EMAILS.map((email) => (
          <div key={email.name}>
            <label className="flex items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                name={email.name}
                defaultChecked={settings[email.name]}
                className="h-4 w-4 accent-[var(--accent-pink)]"
              />
              {email.label}
            </label>
            <p className="ml-6 text-xs text-ink-faint">
              {email.hint}{" "}
              <a href={`/admin/estadisticas/vista-previa?correo=${email.preview}`} target="_blank" className="underline">
                Vista previa
              </a>
            </p>
          </div>
        ))}
      </div>

      {state.status === "error" && state.message ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm font-bold text-accent-pink-2">💾 Ajustes guardados.</p>
      ) : null}

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
