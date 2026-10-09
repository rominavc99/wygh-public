import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const TABS = [
  { href: "/admin/estadisticas", label: "Estadísticas", icon: "📊" },
  { href: "/admin/respuestas", label: "Respuestas", icon: "🗂️" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "👥" },
  { href: "/admin/boletin", label: "Boletín", icon: "💌" },
  { href: "/admin/fotos", label: "Fotos", icon: "🖼️" },
  { href: "/admin/frases", label: "Frases", icon: "💭" },
  { href: "/admin/cumpleanos", label: "Cumpleaños", icon: "🎂" },
  { href: "/admin/envios", label: "Envíos", icon: "📮" },
  { href: "/admin/comunicaciones", label: "Comunicaciones", icon: "📣" },
  { href: "/admin/ajustes", label: "Ajustes", icon: "⚙️" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // El proxy ya protege /admin/*; esta comprobación es defensa en
  // profundidad por si algún día una Server Function queda fuera del
  // matcher del proxy.
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  return (
    <div className="relative z-10 flex flex-1 justify-center px-4 py-8">
      <div className="win h-fit w-full max-w-4xl">
        <div className="win-titlebar">
          <span className="win-icon">🖥️</span>
          <span className="win-title">Panel de administración — {settings.newsletterName}</span>
          <div className="win-btns">
            <div className="win-btn">_</div>
            <div className="win-btn">□</div>
            <Link href="/" className="win-btn close" aria-label="Volver al formulario">
              ×
            </Link>
          </div>
        </div>
        <nav className="win-toolbar">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className="whitespace-nowrap hover:text-chrome-4">
              {tab.icon} {tab.label}
            </Link>
          ))}
        </nav>
        <main className="win-body">{children}</main>
      </div>
    </div>
  );
}
