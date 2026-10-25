"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveResponse, type SaveResponseState } from "./actions";
import { preparePhoto, type PreparedPhoto } from "@/lib/prepare-photo";
import { ASCII_PICKER, EMOJI_CATEGORIES } from "@/lib/emoji-data";
import { EmojiPicker } from "./boletines/emoji-picker";
import type { DeliverableMission } from "@/lib/missions";

/** Lo que ya tenía guardado, si es un resumen del día (las HOME no se editan con este formulario). */
type ExistingResponse = {
  didToday: string | null;
  atHome: boolean;
  wentWhere: string | null;
  food: string;
  bestPart: string | null;
  worstPart: string | null;
  tomorrowPlan: string | null;
  note: string | null;
  mood: string | null;
  photoFilename: string | null;
  photoDescription: string | null;
  phraseText: string | null;
} | null;

/** Un grupo al que puede ir la respuesta (ver responseGroupOptions en src/lib/groups.ts). */
export type FormGroup = { id: string; name: string; checked: boolean; disabled: boolean };

/** De qué día habla el resumen, para las preguntas: "hoy", "ayer" o "ese día" (extraordinarias). */
export type DayWord = "hoy" | "ayer" | "ese día";

/**
 * Lo que la persona llevaba escrito, guardado en el navegador (localStorage)
 * mientras llena el formulario — si el envío falla (sin internet, un
 * bloqueo, se cerró la pestaña), al volver se recupera en vez de tener que
 * escribir todo otra vez. Se borra al guardarse bien en el servidor. La
 * clave lleva usuario y fecha, así que el de ayer no aparece hoy. Las fotos
 * de las misiones no van al borrador, solo su texto.
 */
type Draft = {
  fields: Record<string, string>;
  stayedHome: "si" | "no" | null;
  photo: PreparedPhoto | null;
  removePhoto: boolean;
  savedAt: number;
};

const TEXT_FIELDS = [
  "didToday",
  "wentWhere",
  "food",
  "bestPart",
  "worstPart",
  "tomorrowPlan",
  "note",
  "mood",
  "photoDescription",
  "phrase",
] as const;
type TextField = (typeof TEXT_FIELDS)[number];

type SaveAction = (prevState: SaveResponseState, formData: FormData) => Promise<SaveResponseState>;

function loadDraft(key: string): Draft | null {
  try {
    // Limpieza de borradores de otros días, solo del mismo formulario: el
    // prefijo son los dos primeros tramos de la clave ("wygh:borrador:" o
    // "wygh:extraordinaria:"), para que uno no borre el borrador del otro.
    const prefix = key.split(":").slice(0, 2).join(":") + ":";
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix) && k !== key) localStorage.removeItem(k);
    }
    const raw = localStorage.getItem(key);
    const draft = raw ? (JSON.parse(raw) as Draft) : null;
    // Un borrador del formulario anterior ("¿Qué harás al llegar?") no sirve aquí.
    return draft && "stayedHome" in draft ? draft : null;
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

const NETWORK_ERROR =
  "No se pudo enviar tu resumen (¿se cortó el internet?). No te preocupes: lo que escribiste quedó guardado en este dispositivo. Intenta de nuevo.";

export function ResponseForm({
  existing,
  draftKey,
  action = saveResponse,
  dateOptions,
  dateMax,
  groups = [],
  missions = [],
  dayWord = "hoy",
}: {
  existing: ExistingResponse;
  draftKey: string;
  /** Server Action que guarda; por default la del formulario diario. */
  action?: SaveAction;
  /** Grupos de la persona. Solo se pide elegir si hay dos o más que se puedan elegir. */
  groups?: FormGroup[];
  /** Misiones aceptadas que se entregan con este resumen (solo el formulario diario). */
  missions?: DeliverableMission[];
  dayWord?: DayWord;
  /** Si viene, se pide elegir el día entre estos (formulario de respuestas extraordinarias). */
  dateOptions?: { value: string; label: string }[];
  /** Si viene (y no dateOptions), se pide cualquier día hasta este, con calendario (admins). */
  dateMax?: string;
}) {
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
      action={action}
      dateOptions={dateOptions}
      dateMax={dateMax}
      groups={groups}
      missions={missions}
      dayWord={dayWord}
      onDiscardDraft={() => {
        clearDraft(draftKey);
        setDraft(null);
      }}
    />
  );
}

/** Preguntas que dependen de si el resumen es de hoy, de ayer o de otro día. */
function questions(dayWord: DayWord) {
  if (dayWord === "ayer") {
    return { did: "¿Qué hiciste ayer?", home: "¿Te quedaste en tu casa?", food: "¿Qué comiste ayer? (opcional)", next: "¿Qué crees que harás hoy?" };
  }
  if (dayWord === "ese día") {
    return {
      did: "¿Qué hiciste ese día?",
      home: "¿Te quedaste en tu casa?",
      food: "¿Qué comiste ese día? (opcional)",
      next: "¿Qué pensabas hacer al día siguiente?",
    };
  }
  return { did: "¿Qué hiciste hoy?", home: "¿Te quedaste en tu casa?", food: "¿Qué comiste? (opcional)", next: "¿Qué crees que harás mañana?" };
}

function ResponseFormFields({
  existing,
  draft,
  draftKey,
  action,
  dateOptions,
  dateMax,
  groups,
  missions,
  dayWord,
  onDiscardDraft,
}: {
  existing: ExistingResponse;
  draft: Draft | null;
  draftKey: string;
  action: SaveAction;
  dateOptions?: { value: string; label: string }[];
  dateMax?: string;
  groups: FormGroup[];
  missions: DeliverableMission[];
  dayWord: DayWord;
  onDiscardDraft: () => void;
}) {
  const [state, setState] = useState<SaveResponseState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const [stayedHome, setStayedHome] = useState<"si" | "no" | null>(
    draft?.stayedHome ?? (existing ? (existing.atHome ? "si" : "no") : null)
  );
  const [newPhoto, setNewPhoto] = useState<PreparedPhoto | null>(draft?.photo ?? null);
  const [removePhoto, setRemovePhoto] = useState(draft?.removePhoto ?? false);
  const [missionPhotos, setMissionPhotos] = useState<Record<string, PreparedPhoto | null>>({});
  const [removedMissionPhotos, setRemovedMissionPhotos] = useState<Record<string, boolean>>({});
  const [busyPhotos, setBusyPhotos] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  // Se arrastra el texto de campos que se ocultan (p. ej. "¿A dónde fuiste?"
  // al cambiar a "Sí"), para no perderlo si regresa.
  const fieldsRef = useRef<Record<string, string>>(draft?.fields ?? {});
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const q = questions(dayWord);
  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const hasExistingPhoto = Boolean(existing?.photoFilename) && !removePhoto;
  const photoRequired = Boolean(newPhoto) || hasExistingPhoto;

  function initial(name: TextField | string): string {
    if (draft && name in draft.fields) return draft.fields[name];
    if (name === "phrase") return existing?.phraseText ?? "";
    if (name.startsWith("mission:")) {
      const id = name.split(":")[1];
      return missions.find((m) => m.id === id)?.resolutionText ?? "";
    }
    return (existing?.[name as keyof NonNullable<ExistingResponse>] as string | null | undefined) ?? "";
  }

  function saveDraftNow() {
    const form = formRef.current;
    if (!form) return;
    const names = [...TEXT_FIELDS, "date", ...missions.map((m) => `mission:${m.id}:text`)];
    for (const name of names) {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        fieldsRef.current[name] = el.value;
      }
    }
    writeDraft(draftKey, {
      fields: { ...fieldsRef.current },
      stayedHome,
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
  }, [stayedHome, newPhoto, removePhoto]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  async function readPhoto(file: File | undefined, errorKey: string): Promise<PreparedPhoto | null> {
    dirtyRef.current = true;
    if (!file) return null;
    setBusyPhotos((n) => n + 1);
    try {
      return await preparePhoto(file);
    } catch {
      setState({ status: "error", fieldErrors: { [errorKey]: "No pudimos procesar esa foto. Intenta con otra." } });
      return null;
    } finally {
      setBusyPhotos((n) => n - 1);
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
    if (busyPhotos > 0) return;
    const data = new FormData(e.currentTarget);
    if (newPhoto) {
      data.set("photoData", newPhoto.data);
      data.set("photoType", newPhoto.type);
    }
    for (const [id, photo] of Object.entries(missionPhotos)) {
      if (!photo) continue;
      data.set(`mission:${id}:photoData`, photo.data);
      data.set(`mission:${id}:photoType`, photo.type);
    }
    dirtyRef.current = true;
    clearTimeout(saveTimer.current);
    saveDraftNow();

    startTransition(async () => {
      try {
        const result = await action({ status: "idle" }, data);
        if (result.status === "success") clearDraft(draftKey);
        setState(result);
      } catch {
        setState({ status: "error", message: NETWORK_ERROR });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onInput={scheduleSave} className="flex flex-col gap-5">
      {draft ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-panel-edge bg-panel-2 px-3 py-2 text-sm">
          <span className="font-bold text-accent-pink-2">📝 Recuperamos lo que tenías escrito y no se había enviado.</span>
          <button type="button" onClick={onDiscardDraft} className="xp-btn-secondary text-xs">
            Descartar
          </button>
        </div>
      ) : null}

      {dateOptions ? (
        <Field label="¿Para qué día es tu respuesta?" error={fieldErrors.date}>
          <select
            name="date"
            required
            defaultValue={
              dateOptions.some((o) => o.value === draft?.fields.date) ? draft!.fields.date : dateOptions[0]?.value
            }
            className="xp-select"
          >
            {dateOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      ) : dateMax ? (
        <Field label="¿Para qué día es tu respuesta?" error={fieldErrors.date}>
          <input type="date" name="date" required max={dateMax} defaultValue={draft?.fields.date ?? ""} className="xp-input" />
        </Field>
      ) : null}

      <p className="form-section">Tu día</p>

      <Field label={q.did} error={fieldErrors.didToday} htmlFor="f-didToday">
        <textarea id="f-didToday" name="didToday" rows={3} required defaultValue={initial("didToday")} className="xp-textarea" />
      </Field>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-bold text-ink">{q.home}</legend>
        <div className="seg">
          {(["si", "no"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="stayedHome"
                value={value}
                checked={stayedHome === value}
                onChange={() => setStayedHome(value)}
                required
              />
              {value === "si" ? "Sí" : "No"}
            </label>
          ))}
        </div>
        {fieldErrors.atHome ? <p className="text-sm text-danger">{fieldErrors.atHome}</p> : null}
      </fieldset>

      <Field label="¿A dónde fuiste?" error={fieldErrors.wentWhere} hidden={stayedHome !== "no"} htmlFor="f-wentWhere">
        <input id="f-wentWhere" type="text" name="wentWhere" required defaultValue={initial("wentWhere")} className="xp-input" />
      </Field>

      <Field label={q.food} error={fieldErrors.food} htmlFor="f-food">
        <input id="f-food" type="text" name="food" maxLength={1000} defaultValue={initial("food")} className="xp-input" />
      </Field>

      <hr className="form-rule" />
      <p className="form-section">Lo mejor y lo peor</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="La mejor parte del día fue…" error={fieldErrors.bestPart} htmlFor="f-bestPart">
          <textarea id="f-bestPart" name="bestPart" rows={2} defaultValue={initial("bestPart")} className="xp-textarea" />
        </Field>
        <Field label="La peor parte del día fue…" error={fieldErrors.worstPart} htmlFor="f-worstPart">
          <textarea id="f-worstPart" name="worstPart" rows={2} defaultValue={initial("worstPart")} className="xp-textarea" />
        </Field>
      </div>

      <Field label={q.next} error={fieldErrors.tomorrowPlan} htmlFor="f-tomorrowPlan">
        <textarea id="f-tomorrowPlan" name="tomorrowPlan" rows={2} defaultValue={initial("tomorrowPlan")} className="xp-textarea" />
      </Field>

      <hr className="form-rule" />
      <p className="form-section">Extras</p>

      <MoodField defaultValue={initial("mood")} error={fieldErrors.mood} onChange={scheduleSave} />

      <Field label="Algo que quieras compartir (opcional)" error={fieldErrors.note} htmlFor="f-note">
        <textarea id="f-note" name="note" rows={2} defaultValue={initial("note")} className="xp-textarea" />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-ink">Foto del día (opcional)</span>
        <PhotoPicker
          photo={newPhoto}
          existingUrl={hasExistingPhoto ? `/${existing!.photoFilename}` : null}
          busy={busyPhotos > 0}
          error={fieldErrors.photo}
          label="Foto del día"
          onPick={async (file) => {
            const photo = await readPhoto(file, "photo");
            if (photo) {
              setNewPhoto(photo);
              setRemovePhoto(false);
            }
          }}
          onRemove={() => {
            dirtyRef.current = true;
            if (newPhoto) setNewPhoto(null);
            else setRemovePhoto(true);
          }}
        />
        {/* Solo importa para el servidor cuando se quita la foto ya guardada. */}
        <input type="checkbox" name="removePhoto" checked={removePhoto} readOnly className="hidden" />
      </div>

      <Field
        label="Descripción de la foto"
        error={fieldErrors.photoDescription}
        hidden={!photoRequired}
        htmlFor="f-photoDescription"
      >
        <input id="f-photoDescription" type="text" name="photoDescription" defaultValue={initial("photoDescription")} className="xp-input" />
      </Field>

      <Field label="Frase del día (opcional)" error={fieldErrors.phraseText} htmlFor="f-phrase">
        <p className="text-xs text-ink-faint">
          Si mandas una, entra al catálogo de frases y puede aparecer en la portada del boletín de los grupos a los
          que mandes tu resumen, con tu nombre.
        </p>
        <input id="f-phrase" type="text" name="phrase" maxLength={300} defaultValue={initial("phrase")} className="xp-input" />
      </Field>

      {missions.length ? (
        <>
          <hr className="form-rule" />
          <p className="form-section">Misiones a entregar ({missions.length})</p>
          <p className="-mt-3 text-xs text-ink-faint">
            Cuenta cómo la cumpliste. Si la dejas vacía, sigue pendiente; si no la entregas antes de que salga el
            boletín, cuenta como advertencia.
          </p>
          {missions.map((m) => {
            const key = `mission:${m.id}:text`;
            const removed = removedMissionPhotos[m.id] ?? false;
            const photo = missionPhotos[m.id] ?? null;
            return (
              <div key={m.id} className="mission-card flex flex-col gap-2.5">
                <div className="flex flex-wrap gap-2">
                  <span className="chip chip-pink">Para {m.targetName}</span>
                  {m.requiresPhoto ? <span className="chip chip-neutral">Requiere foto</span> : null}
                </div>
                <p className="text-sm font-bold text-ink">{m.text}</p>
                <textarea
                  name={key}
                  rows={2}
                  maxLength={1000}
                  aria-label={`Cómo cumpliste: ${m.text}`}
                  placeholder="Cuenta cómo la cumpliste"
                  defaultValue={initial(key)}
                  className="xp-textarea"
                />
                <PhotoPicker
                  photo={photo}
                  existingUrl={m.photoFilename && !removed ? `/${m.photoFilename}` : null}
                  busy={busyPhotos > 0}
                  label={`Foto de la misión para ${m.targetName}`}
                  onPick={async (file) => {
                    const prepared = await readPhoto(file, key);
                    if (prepared) setMissionPhotos((prev) => ({ ...prev, [m.id]: prepared }));
                  }}
                  onRemove={() => {
                    if (photo) setMissionPhotos((prev) => ({ ...prev, [m.id]: null }));
                    else setRemovedMissionPhotos((prev) => ({ ...prev, [m.id]: true }));
                  }}
                />
                <input type="checkbox" name={`mission:${m.id}:removePhoto`} checked={removed} readOnly className="hidden" />
                {fieldErrors[key] ? <p className="text-sm text-danger">{fieldErrors[key]}</p> : null}
              </div>
            );
          })}
        </>
      ) : null}

      <GroupPicker groups={groups} error={fieldErrors.groups} />

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-sm font-bold text-chrome-4">
          ✅ Listo, tu resumen quedó guardado.
        </p>
      ) : null}

      <button type="submit" disabled={pending || busyPhotos > 0} className="xp-btn w-full sm:w-auto sm:self-end">
        {pending ? "Guardando…" : existing ? "Actualizar resumen" : "Enviar resumen"}
      </button>
    </form>
  );
}

/** "Estado": texto libre con un botón para agregarle un emoji. */
function MoodField({ defaultValue, error, onChange }: { defaultValue: string; error?: string; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // Dónde estaba el cursor la última vez que se escribió en el campo. Sin
  // esto, si nunca se tocó, el navegador reporta la posición 0 y el emoji
  // terminaba al principio del texto en vez de al final.
  const caretRef = useRef<{ start: number; end: number } | null>(null);

  function rememberCaret() {
    const input = inputRef.current;
    if (input) caretRef.current = { start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length };
  }

  function insert(emoji: string) {
    const input = inputRef.current;
    if (!input) return;
    const { start, end } = caretRef.current ?? { start: input.value.length, end: input.value.length };
    const before = input.value.slice(0, start);
    // Un espacio de separación si va pegado a texto (los emoticones de texto se leen mal juntos).
    const glue = before && !before.endsWith(" ") ? " " : "";
    input.value = `${before}${glue}${emoji}${input.value.slice(end)}`.slice(0, 120);
    const caret = Math.min(before.length + glue.length + emoji.length, input.value.length);
    caretRef.current = { start: caret, end: caret };
    input.focus();
    input.setSelectionRange(caret, caret);
    onChange();
  }

  return (
    <Field label="Estado" error={error} htmlFor="f-mood">
      <div className="flex gap-2">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Agregar un emoji al estado"
          aria-expanded={open}
          className="xp-btn-secondary flex-none px-3 text-lg leading-none"
        >
          😊
        </button>
        <input
          ref={inputRef}
          id="f-mood"
          type="text"
          name="mood"
          onSelect={rememberCaret}
          onKeyUp={rememberCaret}
          required
          maxLength={120}
          placeholder="Feliz, con sueño, en modo hibernación…"
          defaultValue={defaultValue}
          className="xp-input"
        />
      </div>
      {open ? (
        <EmojiPicker
          categories={EMOJI_CATEGORIES}
          asciiItems={ASCII_PICKER}
          searchable
          label="Emoji para el estado"
          anchorRef={triggerRef}
          onClose={() => setOpen(false)}
          onSelect={insert}
        />
      ) : null}
    </Field>
  );
}

/** Elegir, ver y quitar una foto (la del día o la de una misión). */
function PhotoPicker({
  photo,
  existingUrl,
  busy,
  error,
  label,
  onPick,
  onRemove,
}: {
  photo: PreparedPhoto | null;
  existingUrl: string | null;
  busy: boolean;
  error?: string;
  label: string;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = photo?.dataUrl ?? existingUrl;

  return (
    <div className="flex flex-col gap-1.5">
      {preview ? (
        <div className="relative h-24 w-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-24 w-24 rounded-lg border-2 border-[var(--nb-line)] object-cover" />
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              onRemove();
            }}
            aria-label={`Quitar ${label.toLowerCase()}`}
            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-danger text-sm font-bold leading-none text-white shadow hover:opacity-90"
          >
            ×
          </button>
        </div>
      ) : null}
      {busy ? <p className="text-xs text-ink-faint">Procesando foto…</p> : null}
      {/* Sin name a propósito: la foto no viaja como archivo sino ya
          preparada en base64 (ver handleSubmit y src/lib/prepare-photo.ts).
          image/* y no la lista exacta de tipos: con la lista, el selector de
          Fotos del iPhone no deja elegir las HEIC; preparePhoto las convierte. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label={label}
        onChange={(e) => onPick(e.target.files?.[0])}
        className="xp-input"
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

/**
 * A qué grupos va la respuesta. Con un solo grupo elegible no se muestra:
 * va directo ahí. Por defecto vienen todos marcados; los que ya mandaron su
 * boletín salen deshabilitados para que se entienda por qué.
 */
function GroupPicker({ groups, error }: { groups: FormGroup[]; error?: string }) {
  const selectable = groups.filter((g) => !g.disabled);
  const [checked, setChecked] = useState(() => new Set(selectable.filter((g) => g.checked).map((g) => g.id)));
  if (selectable.length < 2) return null;

  const allChecked = selectable.every((g) => checked.has(g.id));
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-panel-edge bg-panel-2 p-3">
      <legend className="px-1 text-sm font-bold text-ink">🫂 ¿A qué grupos lo mandas?</legend>
      <label className="flex min-h-8 items-center gap-2 text-sm font-bold text-ink">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={() => setChecked(allChecked ? new Set() : new Set(selectable.map((g) => g.id)))}
          className="h-5 w-5 accent-[var(--accent-pink)]"
        />
        A todos mis grupos
      </label>
      <div className="ml-7 flex flex-wrap gap-x-4 gap-y-1">
        {groups.map((g) => (
          <label key={g.id} className={`flex min-h-8 items-center gap-1.5 text-sm ${g.disabled ? "text-ink-faint" : "text-ink"}`}>
            <input
              type="checkbox"
              name={g.disabled ? undefined : "groupIds"}
              value={g.id}
              checked={g.disabled ? g.checked : checked.has(g.id)}
              disabled={g.disabled}
              onChange={() => toggle(g.id)}
              className="h-5 w-5 accent-[var(--accent-pink)]"
            />
            {g.name}
            {g.disabled ? <span className="text-xs">(su boletín ya salió)</span> : null}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}

function Field({
  label,
  error,
  hidden,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hidden?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  if (hidden) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
