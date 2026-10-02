export default function VerifyRequestPage() {
  return (
    <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-16">
      <div className="win w-full max-w-sm">
        <div className="win-titlebar">
          <span className="win-icon">📬</span>
          <span className="win-title">Revisa tu correo</span>
          <div className="win-btns">
            <div className="win-btn">_</div>
            <div className="win-btn">□</div>
            <div className="win-btn close">×</div>
          </div>
        </div>
        <div className="win-body text-center">
          <p className="mb-1 text-3xl">📨✨</p>
          <h1 className="mb-2 text-xl font-bold text-ink">Revisa tu correo</h1>
          <p className="text-sm text-ink-soft">
            Si tu correo está registrado, deberías recibir un enlace para
            entrar. Ábrelo desde este mismo dispositivo o navegador.
          </p>
        </div>
      </div>
    </main>
  );
}
