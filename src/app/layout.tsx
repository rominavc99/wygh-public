import type { Metadata, Viewport } from "next";
import { Baloo_2, Varela_Round } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const varela = Varela_Round({
  variable: "--font-varela",
  subsets: ["latin"],
  weight: "400",
});

// Nombre y lema salen de Ajustes, para que cada instalación muestre los suyos.
// Si la base no está disponible (p. ej. al compilar páginas estáticas en
// una máquina sin data/app.db), se usan los valores por defecto.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await prisma.settings
    .findUnique({ where: { id: 1 }, select: { newsletterName: true, tagline: true } })
    .catch(() => null) ?? { newsletterName: "De regreso a casa", tagline: "Una nota diaria entre amigos" };
  return {
    title: settings.newsletterName,
    description: settings.tagline,
    openGraph: { title: settings.newsletterName, description: settings.tagline },
  };
}

// Look retro fijo a propósito: le pide al navegador que no aplique su modo
// oscuro automático (ni a la página ni a los controles nativos).
export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${baloo.variable} ${varela.variable} h-full antialiased`}>
      {/* suppressHydrationWarning solo tapa mismatches de los atributos
          PROPIOS de body (no de lo que hay adentro) — es justo el alcance
          de este problema conocido: extensiones como ColorZilla le
          inyectan cz-shortcut-listen al body antes de que React cargue,
          y eso no es nada que la app esté haciendo mal. Un mismatch real
          en cualquier otro lado del árbol se sigue reportando normal. */}
      <body className="min-h-full flex flex-col relative" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
