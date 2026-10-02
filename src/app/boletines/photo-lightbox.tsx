"use client";

import { useEffect, useState } from "react";

/** Miniatura clickeable que abre una previsualización a pantalla completa, con zoom. */
export function ZoomableImage({
  src,
  alt,
  caption,
  className,
}: {
  src: string;
  alt: string;
  caption?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`cursor-zoom-in ${className ?? ""}`}
        onClick={() => {
          setZoomed(false);
          setOpen(true);
        }}
      />

      {open ? (
        <div
          role="dialog"
          aria-label={alt || "Foto"}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-ink hover:bg-white"
          >
            ×
          </button>

          <div
            className={`flex-1 w-full ${zoomed ? "overflow-auto" : "overflow-hidden"} flex items-center justify-center`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              onClick={() => setZoomed((z) => !z)}
              className={
                zoomed
                  ? "max-w-none cursor-zoom-out"
                  : "max-h-[85vh] max-w-[90vw] cursor-zoom-in object-contain"
              }
            />
          </div>

          {caption ? (
            <p className="max-w-[90vw] text-center text-sm text-white/80" onClick={(e) => e.stopPropagation()}>
              {caption}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
