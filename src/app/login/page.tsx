import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

/**
 * Auth.js manda aquí sus errores (pages.error) con un código en ?error=.
 * Antes todos decían "No pudimos enviarte el enlace", aunque el correo sí
 * hubiera llegado y lo que fallara fuera entrar con el código.
 */
function loginErrorMessage(code: string): string {
  switch (code) {
    case "Verification":
      return "Ese código o enlace ya no sirve: expiró o ya se usó. Pide uno nuevo aquí abajo.";
    case "AccessDenied":
      return "Ese correo no tiene acceso al boletín (no está registrado o la cuenta está desactivada). Avísale al admin del grupo.";
    case "EmailSignin":
      return "No pudimos enviarte el correo con el código. Intenta de nuevo en un momento; si sigue fallando, avísale al admin del grupo.";
    case "Configuration":
      return "Tu código era correcto, pero algo falló de nuestro lado al iniciar tu sesión. Pide un código nuevo e intenta otra vez; si vuelve a pasar, avísale al admin del grupo.";
    default:
      return "Algo falló al iniciar sesión. Pide un código nuevo e intenta otra vez; si vuelve a pasar, avísale al admin del grupo.";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/";
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  return (
    <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-16">
      <div className="win w-full max-w-sm">
        <div className="win-titlebar">
          <span className="win-icon">🔑</span>
          <span className="win-title">Iniciar sesión</span>
          <div className="win-btns">
            <div className="win-btn">_</div>
            <div className="win-btn">□</div>
            <div className="win-btn close">×</div>
          </div>
        </div>
        <div className="win-body">
          <h1 className="mb-1 text-xl font-bold text-ink">{settings.newsletterName}</h1>
          <p className="mb-6 text-sm text-ink-soft">
            Escribe tu correo y te mandaremos un código para entrar ✨
          </p>

          <LoginForm callbackUrl={callbackUrl} />

          {params.error ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {loginErrorMessage(params.error)}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
