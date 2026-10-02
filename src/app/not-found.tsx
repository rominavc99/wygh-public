import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="win">
          <div className="win-titlebar">
            <span className="win-icon">🧭</span>
            <span className="win-title">Error 404</span>
            <div className="win-btns">
              <div className="win-btn">_</div>
              <div className="win-btn">□</div>
              <Link href="/" className="win-btn close" aria-label="Volver al inicio">
                ×
              </Link>
            </div>
          </div>
          <div className="win-body flex flex-col items-center gap-4 text-center">
            <p className="text-4xl">🕸️🐛</p>
            <div>
              <p className="text-lg font-bold text-ink">Esta página no existe</p>
              <p className="text-sm text-ink-soft">
                Se perdió en el camino a casa, como cuando alguien dice &quot;ya casi llego&quot;.
              </p>
            </div>
            <Link href="/" className="xp-btn w-fit">
              🏠 Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
