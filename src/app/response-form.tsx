"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveResponse, type SaveResponseState } from "./actions";
import { preparePhoto, type PreparedPhoto } from "@/lib/prepare-photo";

type ExistingResponse = {
  atHome: boolean;
  arrivingLate: boolean;
  beforeHomePlan: string | null;
  stayedHome: boolean;
  homePlan: string | null;
  awayPlan: string | null;
  tonightPlan: string | null;
  food: string;
  goingOut: boolean;
  goingOutWhere: string | null;
  note: string | null;
  photoFilename: string | null;
  photoDescription: string | null;
  phraseText: string | null;
} | null;

type HomeStatus = "onTime" | "later" | "away" | "stayed";

/**
 * Lo que la persona llevaba escrito, guardado en el navegador (localStorage)
 * mientras llena el formulario — si el envío falla (sin internet, un
 * bloqueo, se cerró la pestaña), al volver se recupera en vez de tener que
 * escribir todo otra vez. Se borra al guardarse bien en el servidor. La
 * clave lleva usuario y fecha, así que el de ayer no aparece hoy.
 */
type Draft = {
  fields: Record<string, string>;
  homeStatus: HomeStatus;
  goingOut: boolean;
  photo: PreparedPhoto | null;
  removePhoto: boolean;
  savedAt: number;
};

const DRAFT_PREFIX = "wygh:borrador:";
const TEXT_FIELDS = [
  "beforeHomePlan",
  "homePlan",
  "awayPlan",
  "tonightPlan",
  "food",
  "goingOutWhere",
  "note",
  "photoDescription",
  "phrase",
] as const;

function loadDraft(key: string): Draft | null {
  try {
    // Limpieza de borradores de otros días.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(DRAFT_PREFIX) && k !== key) localStorage.removeItem(k);
    }
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: Draft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Sin espacio (la foto es lo pesado): al menos se guarda el texto.
    try {
      localStorage.setItem(key, JSON.stringify({ ...draft, photo: null }));
    } catch {
      // Storage bloqueado (modo privado, etc.): no hay borrador, sigue igual.
    }
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Igual que arriba.
  }
}

function homeStatusFor(existing: ExistingResponse): HomeStatus {
  if (!existing) return "onTime";
  if (!existing.atHome) return "away";
  if (existing.stayedHome) return "stayed";
  return existing.arrivingLate ? "later" : "onTime";
}

const NETWORK_ERROR =
  "No se pudo enviar tu respuesta (¿se cortó el internet?). No te preocupes: lo que escribiste quedó guardado en este dispositivo. Intenta de nuevo.";

export function ResponseForm({ existing, draftKey }: { existing: ExistingResponse; draftKey: string }) {
  // El borrador solo existe en el navegador: se lee después de montar (en
  // el render del servidor no hay localStorage) y, si hay uno, el
  // formulario se vuelve a montar con esos valores.
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    const saved = loadDraft(draftKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage, que solo existe tras montar
    if (saved) setDraft(saved);
  }, [draftKey]);

  return (
    <ResponseFormFields
      key={draft ? `borrador-${draft.savedAt}` : "servidor"}
      existing={existing}
      draft={draft}
      draftKey={draftKey}
      onDiscardDraft={() => {
        clearDraft(draftKey);
        setDraft(null);
      }}
    />
  );
}

function ResponseFormFields({
  existing,
  draft,
  draftKey,
  onDiscardDraft,
}: {
  existing: ExistingResponse;
  draft: Draft | null;
  draftKey: string;
  onDiscardDraft: () => void;
}) {
  const [state, setState] = useState<SaveResponseState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const [homeStatus, setHomeStatus] = useState<HomeStatus>(draft?.homeStatus ?? homeStatusFor(existing));
  const [goingOut, setGoingOut] = useState(draft?.goingOut ?? existing?.goingOut ?? false);
  const [newPhoto, setNewPhoto] = useState<PreparedPhoto | null>(draft?.photo ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(draft?.removePhoto ?? false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Se arrastra el texto de campos que se ocultan (p. ej. al cambiar de
  // "llego a la hora normal" a "no llego"), para no perderlo si regresa.
  const fieldsRef = useRef<Record<string, string>>(draft?.fields ?? {});
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const hasExistingPhoto = Boolean(existing?.photoFilename) && !removePhoto;
  const photoRequired = Boolean(newPhoto) || hasExistingPhoto;

  function initial(name: (typeof TEXT_FIELDS)[number]): string {
    if (draft && name in draft.fields) return draft.fields[name];
    if (name === "phrase") return existing?.phraseText ?? "";
    return (existing?.[name] as string | null | undefined) ?? "";
  }

  function saveDraftNow() {
    const form = formRef.current;
    if (!form) return;
    for (const name of TEXT_FIELDS) {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) fieldsRef.current[name] = el.value;
    }
    writeDraft(draftKey, {
      fields: { ...fieldsRef.current },
      homeStatus,
      goingOut,
      photo: newPhoto,
      removePhoto,
      savedAt: Date.now(),
    });
  }

  function scheduleSave() {
    dirtyRef.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveDraftNow, 400);
  }

  // Los cambios de radios/foto también van al borrador (el texto se
  // guarda desde onInput del <form>).
  useEffect(() => {
    if (dirtyRef.current) saveDraftNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambian estos valores
  }, [homeStatus, goingOut, newPhoto, removePhoto]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    dirtyRef.current = true;
    if (!file) {
      setNewPhoto(null);
      return;
    }
    setPhotoBusy(true);
    try {
      setNewPhoto(await preparePhoto(file));
      setRemovePhoto(false);
    } catch {
      setState({ status: "error", fieldErrors: { photo: "No pudimos procesar esa foto. Intenta con otra." } });
    } finally {
      setPhotoBusy(false);
    }
  }

  function handleRemovePhoto() {
    dirtyRef.current = true;
    if (newPhoto) {
      setNewPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setRemovePhoto(true);
    }
  }

  // No se usa <form action={...}> a propósito: React 19 hace un reset
  // nativo del <form> (incluyendo campos controlados como los radios de
  // abajo) cada vez que se despacha esa acción, sin importar si el
  // resultado es error — así que un error de validación borraba todo lo
  // ya escrito. Además, llamando la acción a mano se puede atrapar un
  // fallo de red/bloqueo (que antes tumbaba la página con "Algo tronó")
  // y dejar el formulario tal cual, con el borrador a salvo.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (photoBusy) return;
    const data = new FormData(e.currentTarget);
    if (newPhoto) {
      data.set("photoData", newPhoto.data);
      data.set("photoType", newPhoto.type);
    }
    dirtyRef.current = true;
    clearTimeout(saveTimer.current);
    saveDraftNow();

    startTransition(async () => {
      try {
        const result = await saveResponse({ status: "idle" }, data);
        if (result.status === "success") clearDraft(draftKey);
        setState(result);
      } catch {
        setState({ status: "error", message: NETWORK_ERROR });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onInput={scheduleSave} className="flex flex-col gap-6">
      {draft ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-panel-edge bg-panel-2 px-3 py-2 text-sm">
          <span className="font-bold text-accent-pink-2">📝 Recuperamos lo que tenías escrito y no se había enviado.</span>
          <button type="button" onClick={onDiscardDraft} className="xp-btn-secondary text-xs">
            Descartar
          </button>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold text-ink">¿Vas a llegar a tu casa hoy?</legend>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input
              type="radio"
              name="homeStatus"
              value="onTime"
              checked={homeStatus === "onTime"}
              onChange={() => setHomeStatus("onTime")}
              className="h-4 w-4 accent-[var(--accent-pink)]"
            />
            Sí, llegaré a la hora normal
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input
              type="radio"
              name="homeStatus"
              value="later"
              checked={homeStatus === "later"}
              onChange={() => setHomeStatus("later")}
              className="h-4 w-4 accent-[var(--accent-pink)]"
            />
            Sí, voy a llegar más tarde
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input
              type="radio"
              name="homeStatus"
              value="away"
              checked={homeStatus === "away"}
              onChange={() => setHomeStatus("away")}
              className="h-4 w-4 accent-[var(--accent-pink)]"
            />
            No voy a llegar a mi casa hoy
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input
              type="radio"
              name="homeStatus"
              value="stayed"
              checked={homeStatus === "stayed"}
              onChange={() => setHomeStatus("stayed")}
              className="h-4 w-4 accent-[var(--accent-pink)]"
            />
            Hoy me quedé en la casa
          </label>
        </div>
      </fieldset>

      <Field
        label="¿Qué harás antes de llegar a tu casa?"
        error={fieldErrors.beforeHomePlan}
        hidden={homeStatus !== "later"}
      >
        <textarea
          name="beforeHomePlan"
          rows={3}
          defaultValue={initial("beforeHomePlan")}
          className={textareaClass}
        />
      </Field>

      <Field
        label={homeStatus === "stayed" ? "¿Qué hiciste hoy en tu casa?" : "¿Qué vas a hacer cuando llegues a tu casa?"}
        error={fieldErrors.homePlan}
        hidden={homeStatus === "away"}
      >
        <textarea
          name="homePlan"
          rows={3}
          defaultValue={initial("homePlan")}
          className={textareaClass}
        />
      </Field>

      <Field label="¿Para dónde vas y a qué?" error={fieldErrors.awayPlan} hidden={homeStatus !== "away"}>
        <textarea
          name="awayPlan"
          rows={3}
          defaultValue={initial("awayPlan")}
          className={textareaClass}
        />
      </Field>

      <Field label="¿Qué harás en la noche?" error={fieldErrors.tonightPlan} hidden={homeStatus !== "stayed"}>
        <textarea
          name="tonightPlan"
          rows={3}
          defaultValue={initial("tonightPlan")}
          className={textareaClass}
        />
      </Field>

      <Field label="¿Qué vas a comer?" error={fieldErrors.food}>
        <textarea
          name="food"
          rows={2}
          required
          defaultValue={initial("food")}
          className={textareaClass}
        />
      </Field>

      {homeStatus === "onTime" ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-bold text-ink">¿Vas a salir?</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input
                  type="radio"
                  name="goingOut"
                  value="si"
                  checked={goingOut}
                  onChange={() => setGoingOut(true)}
                  className="h-4 w-4 accent-[var(--accent-pink)]"
                />
                Sí
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input
                  type="radio"
                  name="goingOut"
                  value="no"
                  checked={!goingOut}
                  onChange={() => setGoingOut(false)}
                  className="h-4 w-4 accent-[var(--accent-pink)]"
                />
                No
              </label>
            </div>
          </fieldset>

          <Field label="¿A dónde?" error={fieldErrors.goingOutWhere} hidden={!goingOut}>
            <input
              type="text"
              name="goingOutWhere"
              defaultValue={initial("goingOutWhere")}
              className={inputClass}
            />
          </Field>
        </>
      ) : null}

      <Field label="¿Algo que quieras mencionar? (opcional)">
        <textarea
          name="note"
          rows={2}
          defaultValue={initial("note")}
          className={textareaClass}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-ink">Foto del día (opcional)</label>

        {newPhoto || hasExistingPhoto ? (
          <div className="group relative h-20 w-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={newPhoto?.dataUrl ?? `/${existing!.photoFilename}`}
              alt=""
              className="h-20 w-20 rounded-lg border border-panel-edge object-cover"
            />
            <button
              type="button"
              onClick={handleRemovePhoto}
              title="Quitar foto"
              aria-label="Quitar foto"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-danger text-xs font-bold leading-none text-white shadow hover:opacity-90"
            >
              ×
            </button>
          </div>
        ) : null}

        {/* Solo importa para el servidor cuando se quita la foto ya
            guardada — si es una foto nueva sin guardar, basta con vaciar
            el <input type="file"> (ver handleRemovePhoto). */}
        <input type="checkbox" name="removePhoto" checked={removePhoto} readOnly className="hidden" />

        {fieldErrors.photo ? <p className="text-sm text-danger">{fieldErrors.photo}</p> : null}

        {/* Sin name a propósito: la foto no viaja como archivo sino ya
            preparada en base64 (ver handleSubmit y src/lib/prepare-photo.ts). */}
        {photoBusy ? <p className="text-xs text-ink-faint">Procesando foto…</p> : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handlePhotoChange}
          className={inputClass}
        />
      </div>

      <Field
        label={`Descripción de la foto${photoRequired ? "" : " (opcional)"}`}
        error={fieldErrors.photoDescription}
        hidden={!photoRequired}
      >
        <input
          type="text"
          name="photoDescription"
          defaultValue={initial("photoDescription")}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-ink">Frase del día (opcional)</label>
        <p className="text-xs text-ink-faint">
          Si mandas una, entra al catálogo de frases y puede aparecer en la portada de
          cualquier boletín, con tu nombre.
        </p>
        <input
          type="text"
          name="phrase"
          maxLength={300}
          defaultValue={initial("phrase")}
          className={inputClass}
        />
        {fieldErrors.phraseText ? <p className="text-sm text-danger">{fieldErrors.phraseText}</p> : null}
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={pending || photoBusy} className="xp-btn self-start">
        {pending ? "Guardando…" : existing ? "Actualizar" : "Enviar →"}
      </button>
    </form>
  );
}

const textareaClass = "xp-textarea";
const inputClass = "xp-input";

function Field({
  label,
  error,
  hidden,
  children,
}: {
  label: string;
  error?: string;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-ink">{label}</label>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
