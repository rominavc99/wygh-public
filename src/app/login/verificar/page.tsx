import Link from "next/link";
import { CodeForm } from "./code-form";

export default async function VerifyRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/";

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
          {params.email ? (
            <>
              <p className="mb-5 text-sm text-ink-soft">
                Te mandamos un código a <strong className="text-ink">{params.email}</strong>.
                Escríbelo aquí para quedarte con la sesión abierta en esta
                misma pantalla.
              </p>
              <CodeForm email={params.email} callbackUrl={callbackUrl} />
              <p className="mt-5 text-xs text-ink-soft">
                ¿No llegó? Revisa en spam o{" "}
                <Link href={`/login?${new URLSearchParams({ callbackUrl })}`} className="underline">
                  pide otro
                </Link>
                .
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              Si tu correo está registrado, deberías recibir un enlace para
              entrar. Ábrelo desde este mismo dispositivo o navegador.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
