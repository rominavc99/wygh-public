"use client";

import { useRef, useState, type RefObject } from "react";
import type { EmojiCategory } from "@/lib/emoji-data";
import { Popover } from "./popover";

/** Minúsculas y sin acentos, para buscar "cafe" y encontrar "café". */
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function EmojiPicker({
  items,
  categories,
  onSelect,
  onClose,
  label,
  variant = "emoji",
  anchorRef,
  searchable = false,
  asciiItems,
}: {
  items?: string[];
  /** Si se pasan, el selector muestra pestañas para saltar entre categorías. */
  categories?: EmojiCategory[];
  onSelect: (value: string) => void;
  onClose: () => void;
  label: string;
  variant?: "emoji" | "ascii";
  anchorRef: RefObject<HTMLElement | null>;
  /** Buscador por nombre (en español) arriba de las categorías. */
  searchable?: boolean;
  /** Si viene, una segunda pestaña con estos emoticones de texto. */
  asciiItems?: string[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"emoji" | "ascii">("emoji");
  const [query, setQuery] = useState("");
  // Los nombres pesan (~80 KB): se bajan hasta que alguien escribe en el buscador.
  const [names, setNames] = useState<Record<string, string> | null>(null);
  const showAscii = variant === "ascii" || tab === "ascii";
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const results =
    terms.length && names && categories
      ? [...new Set(categories.flatMap((c) => c.emojis))].filter((e) => {
          const name = names[e];
          return name ? terms.every((t) => normalize(name).includes(t)) : false;
        })
      : null;

  function search(value: string) {
    setQuery(value);
    if (!names) void import("@/lib/emoji-names").then((m) => setNames(m.EMOJI_NAMES));
  }
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const pick = (item: string) => {
    onSelect(item);
    onClose();
  };

  const emojiButton = (item: string) => (
    <button
      key={item}
      type="button"
      title={item}
      onClick={() => pick(item)}
      className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-panel-2"
    >
      {item}
    </button>
  );

  return (
    <Popover anchorRef={anchorRef} onClose={onClose} label={label}>
      <div
        className={`flex flex-col overflow-hidden rounded-xl border-2 border-panel-edge bg-panel shadow-lg ${
          variant === "ascii" ? "w-72" : "w-[19rem] max-w-[calc(100vw-2rem)]"
        }`}
      >
        {asciiItems ? (
          <div className="grid shrink-0 grid-cols-2 border-b border-panel-edge text-xs font-bold" role="tablist">
            {(["emoji", "ascii"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`min-h-9 ${tab === t ? "bg-chrome-3 text-white" : "bg-panel-2 text-ink-soft"}`}
              >
                {t === "emoji" ? "😊 Emojis" : "(^_^) De texto"}
              </button>
            ))}
          </div>
        ) : null}
        {searchable && !showAscii ? (
          <div className="shrink-0 border-b border-panel-edge p-1.5">
            <input
              type="search"
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Buscar: feliz, pizza, gato…"
              aria-label="Buscar emoji por nombre"
              autoFocus
              className="w-full rounded-md border border-panel-edge bg-white px-2 py-1.5 text-sm"
            />
          </div>
        ) : null}
        {categories && !showAscii && !results ? (
          <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-panel-edge bg-panel-2 px-1.5 py-1">
            {categories.map((c, i) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                aria-label={c.name}
                onClick={() => {
                  const section = sectionRefs.current[i];
                  // El contenedor es "relative", así que offsetTop ya es relativo a él.
                  if (section && scrollRef.current) scrollRef.current.scrollTop = section.offsetTop;
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base hover:bg-panel"
              >
                {c.icon}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={scrollRef} className="relative max-h-64 overflow-y-auto p-2">
          {showAscii ? (
            <div className="flex flex-wrap gap-1">
              {(variant === "ascii" ? items ?? [] : asciiItems ?? []).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => pick(item)}
                  className="rounded-md border border-panel-edge bg-panel-2 px-2 py-1 font-mono text-xs hover:bg-[var(--bubble-1)]"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : results ? (
            results.length ? (
              <div className="grid grid-cols-8 gap-0.5">{results.slice(0, 160).map(emojiButton)}</div>
            ) : (
              <p className="px-1 py-3 text-center text-xs text-ink-soft">No encontramos emojis con &quot;{query}&quot;.</p>
            )
          ) : categories ? (
            categories.map((c, i) => (
              <section
                key={c.name}
                ref={(el) => {
                  sectionRefs.current[i] = el;
                }}
                className="mb-2"
              >
                <p className="sticky top-[-0.5rem] z-10 bg-panel py-1 text-[11px] font-bold text-ink-soft">{c.name}</p>
                <div className="grid grid-cols-8 gap-0.5">{c.emojis.map(emojiButton)}</div>
              </section>
            ))
          ) : (
            <div className="grid grid-cols-8 gap-0.5">{(items ?? []).map(emojiButton)}</div>
          )}
        </div>
      </div>
    </Popover>
  );
}
