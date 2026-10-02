"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="win">
          <div className="win-titlebar">
            <span className="win-icon">⚠️</span>
            <span className="win-title">Error del sistema</span>
            <div className="win-btns">
              <div className="win-btn">_</div>
              <div className="win-btn">□</div>
              <Link href="/" className="win-btn close" aria-label="Volver al inicio">
                ×
              </Link>
            </div>
          </div>
          <div className="win-body flex flex-col items-center gap-4 text-center">
            <p className="text-4xl">💾💥</p>
            <div>
              <p className="text-lg font-bold text-ink">Algo tronó por acá</p>
              <p className="text-sm text-ink-soft">
                Ocurrió un error inesperado. Ya quedó registrado — intenta de nuevo en un momento.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => reset()} className="xp-btn">
                🔄 Reintentar
              </button>
              <Link href="/" className="xp-btn-secondary">
                🏠 Inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
