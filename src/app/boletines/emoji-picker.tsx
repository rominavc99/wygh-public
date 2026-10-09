"use client";

import { useRef, type RefObject } from "react";
import type { EmojiCategory } from "@/lib/emoji-data";
import { Popover } from "./popover";

export function EmojiPicker({
  items,
  categories,
  onSelect,
  onClose,
  label,
  variant = "emoji",
  anchorRef,
}: {
  items?: string[];
  /** Si se pasan, el selector muestra pestañas para saltar entre categorías. */
  categories?: EmojiCategory[];
  onSelect: (value: string) => void;
  onClose: () => void;
  label: string;
  variant?: "emoji" | "ascii";
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
        {categories ? (
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
          {variant === "ascii" ? (
            <div className="flex flex-wrap gap-1">
              {(items ?? []).map((item) => (
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
