import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

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
            <p className="mt-4 text-sm text-danger">
              No pudimos enviarte el enlace. Si crees que deberías tener acceso,
              avísale al admin del grupo.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
