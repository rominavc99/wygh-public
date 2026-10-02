"use client";

import type { RefObject } from "react";
import { Popover } from "./popover";

export function EmojiPicker({
  items,
  onSelect,
  onClose,
  label,
  variant = "emoji",
  anchorRef,
}: {
  items: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
  label: string;
  variant?: "emoji" | "ascii";
  anchorRef: RefObject<HTMLElement | null>;
}) {
  return (
    <Popover anchorRef={anchorRef} onClose={onClose} label={label}>
      <div
        className={`max-h-56 overflow-y-auto rounded-xl border-2 border-panel-edge bg-panel p-2 shadow-lg ${
          variant === "ascii" ? "w-72" : "w-64"
        }`}
      >
        {variant === "ascii" ? (
          <div className="flex flex-wrap gap-1">
            {items.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="rounded-md border border-panel-edge bg-panel-2 px-2 py-1 font-mono text-xs hover:bg-[var(--bubble-1)]"
              >
                {item}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {items.map((item) => (
              <button
                key={item}
                type="button"
                title={item}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-panel-2"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </Popover>
  );
}
