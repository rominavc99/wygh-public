"use client";

import { useEffect, useRef } from "react";

const TOOLBAR: { command: string; label: string; title: string; arg?: string }[] = [
  { command: "bold", label: "B", title: "Negrita" },
  { command: "italic", label: "I", title: "Cursiva" },
  { command: "underline", label: "U", title: "Subrayado" },
  { command: "formatBlock", label: "H", title: "Título", arg: "h3" },
  { command: "formatBlock", label: "¶", title: "Párrafo normal", arg: "p" },
  { command: "insertUnorderedList", label: "•—", title: "Lista con viñetas" },
  { command: "insertOrderedList", label: "1—", title: "Lista numerada" },
];

/**
 * Editor de texto enriquecido con contentEditable + document.execCommand.
 * Sigue soportado en los navegadores de escritorio pese al aviso de
 * deprecación, y es de sobra para un panel interno de un solo admin — no
 * amerita meter una librería de edición completa al proyecto por esto.
 * El contenido se sincroniza a un <input type="hidden"> para que el
 * <form> que lo envuelve lo mande como cualquier otro campo de FormData.
 */
export function RichTextEditor({
  name,
  defaultValue = "",
  error,
}: {
  name: string;
  defaultValue?: string;
  error?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  // El <input hidden> no lleva defaultValue como prop a propósito: un
  // input nunca "tocado" por el usuario (imposible en uno oculto) no
  // marca el value como dirty, así que React reaplicaría defaultValue en
  // cada re-render del formulario (ej. al cambiar el radio de envío) y
  // borraría lo que sync() ya había guardado. Sembrar el valor inicial a
  // mano, una sola vez al montar, evita eso por completo.
  useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = defaultValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    if (hiddenRef.current && editorRef.current) {
      hiddenRef.current.value = editorRef.current.innerHTML;
    }
  }

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    sync();
  }

  function addLink() {
    const url = window.prompt("URL del enlace:");
    if (!url) return;
    exec("createLink", url);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-ink">Cuerpo del correo</label>
      <div className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-panel-edge bg-panel-2 p-1.5">
        {TOOLBAR.map((btn) => (
          <button
            key={btn.title}
            type="button"
            title={btn.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(btn.command, btn.arg)}
            className="rounded-md border border-panel-edge bg-panel px-2 py-1 text-xs font-bold text-ink-soft hover:bg-[var(--bubble-1)]"
          >
            {btn.label}
          </button>
        ))}
        <button
          type="button"
          title="Insertar enlace"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
          className="rounded-md border border-panel-edge bg-panel px-2 py-1 text-xs font-bold text-ink-soft hover:bg-[var(--bubble-1)]"
        >
          🔗
        </button>
        <button
          type="button"
          title="Limpiar formato"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("removeFormat")}
          className="rounded-md border border-panel-edge bg-panel px-2 py-1 text-xs font-bold text-ink-soft hover:bg-[var(--bubble-1)]"
        >
          ✗
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={sync}
        onBlur={sync}
        suppressContentEditableWarning
        className="min-h-[160px] rounded-b-lg border border-panel-edge bg-white p-3 text-sm leading-relaxed text-ink focus:outline-none"
        dangerouslySetInnerHTML={{ __html: defaultValue }}
      />
      <input ref={hiddenRef} type="hidden" name={name} />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
