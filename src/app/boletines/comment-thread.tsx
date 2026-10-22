"use client";

import { useActionState, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { addComment, editComment, type AddCommentState } from "./actions";
import { ReactionBar, type ReactionSummary } from "./reaction-bar";
import { ZoomableImage } from "./photo-lightbox";
import { preparePhoto, type PreparedPhoto } from "@/lib/prepare-photo";

export type CommentSummary = {
  id: string;
  /** Comentario de primer nivel del que cuelga, o null si es de primer nivel. */
  parentId: string | null;
  authorId: string;
  authorName: string;
  /** Puede venir vacío si el comentario es solo una foto. */
  text: string;
  photoFilename: string | null;
  createdAt: string;
  /** Última edición, o null si nunca se editó. */
  editedAt: string | null;
  reactions: ReactionSummary[];
  /** Nombres de las personas etiquetadas, para resaltar su "@Nombre". */
  mentions: string[];
};

type Person = { id: string; name: string };

const initialState: AddCommentState = { status: "idle" };

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Resalta cada "@Nombre" de las personas etiquetadas en el comentario. */
function CommentText({ text, mentions }: { text: string; mentions: string[] }) {
  if (!text) return null;
  if (mentions.length === 0) return <p className="whitespace-pre-wrap text-ink">{text}</p>;
  const tokens = [...mentions].sort((a, b) => b.length - a.length).map((name) => `@${name}`);
  const pattern = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <p className="whitespace-pre-wrap text-ink">
      {text.split(pattern).map((part, i) =>
        tokens.includes(part) ? (
          <span key={i} className="rounded bg-[var(--bubble-2)] px-0.5 font-bold text-accent-pink-2">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </p>
  );
}

type ComposerHandle = { startReply: (comment: CommentSummary) => void };

/**
 * Cuadro para escribir un comentario: texto con etiquetas "@" y una foto
 * opcional. Sirve para comentar, responder y editar (según `action`).
 */
function CommentComposer({
  action,
  currentUserId,
  mentionable,
  initialText = "",
  initialMentions = [],
  existingPhoto = null,
  onDone,
  onCancel,
  submitLabel = "Enviar",
  autoFocus = false,
  ref,
}: {
  action: (prev: AddCommentState, formData: FormData) => Promise<AddCommentState>;
  currentUserId: string;
  mentionable: Person[];
  initialText?: string;
  initialMentions?: Person[];
  /** Foto que ya tiene el comentario que se está editando. */
  existingPhoto?: string | null;
  onDone?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  autoFocus?: boolean;
  ref?: Ref<ComposerHandle>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const [replyTo, setReplyTo] = useState<CommentSummary | null>(null);
  const [text, setText] = useState(initialText);
  const [mentions, setMentions] = useState<Person[]>(initialMentions);
  const [query, setQuery] = useState<{ start: number; value: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Al terminar de enviar sin error, se limpia el cuadro (es controlado, así
  // que el reinicio automático del formulario no lo vacía).
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && state.status === "idle") {
      setText("");
      setMentions([]);
      setQuery(null);
      setPhoto(null);
      setRemovePhoto(false);
      setReplyTo(null);
      onDone?.();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  // Al elegir "Responder" se etiqueta a quien escribió el comentario (salvo
  // que seas tú) y se lleva el cursor al cuadro.
  useImperativeHandle(ref, () => ({
    startReply(comment: CommentSummary) {
      setReplyTo(comment);
      const author = mentionable.find((p) => p.id === comment.authorId);
      if (author && author.id !== currentUserId) {
        setText((prev) => (prev.includes(`@${author.name}`) ? prev : `@${author.name} ${prev}`));
        setMentions((prev) => (prev.some((p) => p.id === author.id) ? prev : [...prev, author]));
      }
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
      });
    },
  }));

  useEffect(() => {
    if (!autoFocus) return;
    const textarea = textareaRef.current;
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [autoFocus]);

  const suggestions = query
    ? mentionable
        .filter((p) => p.id !== currentUserId)
        .filter((p) => normalize(p.name).split(/\s+/).some((word) => word.startsWith(normalize(query.value))) || normalize(p.name).startsWith(normalize(query.value)))
        .slice(0, 6)
    : [];

  /** Busca un "@algo" justo antes del cursor para abrir la lista de personas. */
  function updateQuery(value: string, caret: number) {
    const match = /(^|\s)@([^\s@]{0,30})$/u.exec(value.slice(0, caret));
    if (match) {
      setQuery({ start: caret - match[2].length - 1, value: match[2] });
      setHighlight(0);
    } else {
      setQuery(null);
    }
  }

  function pickPerson(person: Person) {
    if (!query) return;
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? text.length;
    const insert = `@${person.name} `;
    const next = text.slice(0, query.start) + insert + text.slice(caret);
    setText(next);
    setMentions((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]));
    setQuery(null);
    requestAnimationFrame(() => {
      const position = query.start + insert.length;
      textarea?.focus();
      textarea?.setSelectionRange(position, position);
    });
  }

  // Igual que en el formulario diario: la foto se reduce en el navegador y
  // viaja en base64 (ver src/lib/prepare-photo.ts).
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      setPhoto(await preparePhoto(file));
      setRemovePhoto(false);
    } catch {
      setPhotoError("No pudimos procesar esa foto. Intenta con otra.");
    } finally {
      setPhotoBusy(false);
      e.target.value = "";
    }
  }

  function handleRemovePhoto() {
    if (photo) setPhoto(null);
    else setRemovePhoto(true);
  }

  const shownPhoto = photo?.dataUrl ?? (existingPhoto && !removePhoto ? `/${existingPhoto}` : null);
  const activeMentions = mentions.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-1">
        {replyTo ? (
          <p className="flex items-center gap-2 text-[11px] text-ink-soft">
            ↩ Respondiendo a <strong className="text-ink">{replyTo.authorName}</strong>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="font-bold text-ink-faint hover:text-danger"
              aria-label="Cancelar respuesta"
            >
              ✕
            </button>
          </p>
        ) : null}
        <input type="hidden" name="replyToId" value={replyTo?.id ?? ""} />
        <input type="hidden" name="mentions" value={JSON.stringify(activeMentions)} />
        {photo ? (
          <>
            <input type="hidden" name="photoData" value={photo.data} />
            <input type="hidden" name="photoType" value={photo.type} />
          </>
        ) : null}
        {removePhoto ? <input type="hidden" name="removePhoto" value="on" /> : null}
        {/* El texto va solo en su renglón y los botones abajo: en la misma
            fila, en pantallas de celular el 📷 y "Enviar" dejaban el cuadro
            tan angosto que no se podía escribir. */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            name="text"
            rows={2}
            maxLength={1000}
            value={text}
            placeholder={replyTo ? "Escribe tu respuesta…" : "Comenta… (@ para etiquetar)"}
            className="xp-input w-full text-xs"
            required={!shownPhoto}
            onChange={(e) => {
              setText(e.target.value);
              updateQuery(e.target.value, e.target.selectionStart);
            }}
            onClick={(e) => updateQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
            onBlur={() => setTimeout(() => setQuery(null), 150)}
            onKeyDown={(e) => {
              if (!suggestions.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
              } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pickPerson(suggestions[highlight]);
              } else if (e.key === "Escape") {
                setQuery(null);
              }
            }}
            aria-autocomplete="list"
          />
          {suggestions.length ? (
            <ul
              role="listbox"
              className="absolute left-0 top-full z-20 mt-1 w-56 max-w-full overflow-hidden rounded-lg border-2 border-panel-edge bg-panel shadow-lg"
            >
              {suggestions.map((person, i) => (
                <li key={person.id} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickPerson(person)}
                    className={`block w-full px-3 py-1.5 text-left text-xs ${i === highlight ? "bg-[var(--bubble-1)] font-bold" : ""} text-ink hover:bg-[var(--bubble-1)]`}
                  >
                    @{person.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {photoBusy ? <p className="text-[11px] text-ink-faint">Procesando foto…</p> : null}
        {shownPhoto ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shownPhoto} alt="Foto del comentario" className="h-16 w-16 rounded-lg border border-panel-edge object-cover" />
            <button type="button" onClick={handleRemovePhoto} className="text-[11px] font-bold text-ink-faint hover:text-danger">
              ✕ Quitar foto
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoBusy}
            className="xp-btn-secondary shrink-0 text-xs"
            aria-label={shownPhoto ? "Cambiar foto" : "Agregar foto"}
            title={shownPhoto ? "Cambiar foto" : "Agregar foto"}
          >
            📷 {shownPhoto ? "Cambiar" : "Foto"}
          </button>
          <div className="ml-auto flex items-center gap-3">
            {onCancel ? (
              <button type="button" onClick={onCancel} className="text-[11px] font-bold text-ink-faint hover:text-danger">
                Cancelar
              </button>
            ) : null}
            <button type="submit" disabled={pending || photoBusy} className="xp-btn-secondary shrink-0 text-xs">
              {pending ? "…" : submitLabel}
            </button>
          </div>
        </div>
      </form>
      {/* Fuera del <form> a propósito: el archivo en sí no se manda, solo su
          versión preparada en base64 (campos photoData/photoType). Sin
          capture, para que el iPhone deje elegir desde Fotos. */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
      {photoError ? <p className="text-xs text-danger">{photoError}</p> : null}
      {state.status === "error" ? <p className="text-xs text-danger">{state.message}</p> : null}
    </>
  );
}

export function CommentThread({
  responseId,
  comments,
  currentUserId,
  mentionable,
}: {
  responseId: string;
  comments: CommentSummary[];
  currentUserId: string;
  mentionable: Person[];
}) {
  const [open, setOpen] = useState(comments.length > 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const addAction = addComment.bind(null, responseId);

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  const stopEditing = () => setEditingId(null);

  const renderComment = (c: CommentSummary) => (
    <div key={c.id} className="text-xs">
      <span className="font-bold text-accent-pink-2">{c.authorName}</span>{" "}
      <span className="text-ink-faint">
        {new Date(c.createdAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        {c.editedAt ? " · editado" : ""}
      </span>
      {editingId === c.id ? (
        <div className="mt-1">
          <CommentComposer
            action={editComment.bind(null, c.id)}
            currentUserId={currentUserId}
            mentionable={mentionable}
            initialText={c.text}
            initialMentions={mentionable.filter((p) => c.mentions.includes(p.name))}
            existingPhoto={c.photoFilename}
            onDone={stopEditing}
            onCancel={stopEditing}
            submitLabel="Guardar"
            autoFocus
          />
        </div>
      ) : (
        <>
          <CommentText text={c.text} mentions={c.mentions} />
          {c.photoFilename ? (
            <ZoomableImage
              src={`/${c.photoFilename}`}
              alt={c.text ? `Foto de ${c.authorName}: ${c.text}` : `Foto de ${c.authorName}`}
              className="mt-1 h-24 w-24 rounded-lg border border-panel-edge object-cover"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <ReactionBar target={{ type: "comment", id: c.id }} reactions={c.reactions} compact />
            <button
              type="button"
              onClick={() => composerRef.current?.startReply(c)}
              className="mt-1 text-[11px] font-bold text-ink-soft hover:text-accent-pink-2"
            >
              ↩ Responder
            </button>
            {c.authorId === currentUserId ? (
              <button
                type="button"
                onClick={() => setEditingId(c.id)}
                className="mt-1 text-[11px] font-bold text-ink-soft hover:text-accent-pink-2"
              >
                ✏️ Editar
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-bold text-ink-soft hover:text-accent-pink-2"
      >
        💬 {comments.length > 0 ? `${comments.length} comentario${comments.length === 1 ? "" : "s"}` : "Comentar"}
      </button>

      {open ? (
        <div className="mt-2 flex flex-col gap-2 border-l-2 border-panel-edge pl-3">
          {topLevel.map((c) => {
            const replies = repliesOf(c.id);
            return (
              <div key={c.id} className="flex flex-col gap-2">
                {renderComment(c)}
                {replies.length ? (
                  <div className="ml-2 flex flex-col gap-2 border-l-2 border-[var(--bubble-2)] pl-3">{replies.map(renderComment)}</div>
                ) : null}
              </div>
            );
          })}

          <CommentComposer
            action={addAction}
            currentUserId={currentUserId}
            mentionable={mentionable}
            ref={composerRef}
          />
        </div>
      ) : null}
    </div>
  );
}
