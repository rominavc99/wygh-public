"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Popover anclado a un elemento, renderizado en un portal a document.body.
 * A propósito NO usa position:absolute relativo al DOM local — un
 * contenedor ancestro con overflow-hidden (como el panel de /boletines,
 * necesario para que las esquinas redondeadas se vean bien) recortaría
 * cualquier popover que se abriera cerca del borde, dejándolo "vivo" pero
 * invisible. Con un portal + position:fixed, el popover nunca depende de
 * qué tan lejos esté anidado ni de qué overflow tengan sus ancestros.
 */
export function Popover({
  anchorRef,
  onClose,
  children,
  label,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
  label: string;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Alineado al borde izquierdo del ancla, pero sin salirse de la
      // pantalla por la derecha (en el celular el ancla suele quedar a la
      // derecha y el popover es más ancho que el espacio que queda).
      const width = popoverRef.current?.offsetWidth ?? 0;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPos((prev) => (prev && prev.top === rect.bottom + 6 && prev.left === left ? prev : { top: rect.bottom + 6, left }));
    }
    // El ancho del popover solo se conoce después del primer render, así
    // que se recalcula una vez más en el siguiente frame.
    const frame = requestAnimationFrame(update);
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchorRef]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={label}
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      className="z-50"
    >
      {children}
    </div>,
    document.body
  );
}
