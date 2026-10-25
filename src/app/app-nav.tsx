"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navegación principal. En el celular (menos de 768px) es una barra de
// tareas fija abajo más un encabezado con la campana; de ahí para arriba,
// la misma navegación es un menú lateral tipo ventana "Inicio".

type Item = { href: string; label: string; icon: React.ReactNode; badge?: number; match: (path: string) => boolean };

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const HomeIcon = (
  <svg {...iconProps}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);
const MailIcon = (
  <svg {...iconProps}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
const TargetIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);
const UserIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
const BellIcon = (
  <svg {...iconProps}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const GearIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </svg>
);

function Badge({ count, className = "" }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={`nav-badge ${className}`} aria-label={`${count} pendientes`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppNav({
  siteName,
  unread,
  pendingMissions,
  isAdmin,
  signOut,
}: {
  siteName: string;
  unread: number;
  pendingMissions: number;
  isAdmin: boolean;
  /** El botón de cerrar sesión (Server Action), para el menú lateral. */
  signOut: React.ReactNode;
}) {
  const path = usePathname();
  const items: Item[] = [
    { href: "/", label: "Hoy", icon: HomeIcon, match: (p) => p === "/" || p.startsWith("/respuesta-extraordinaria") },
    { href: "/boletines", label: "Boletines", icon: MailIcon, match: (p) => p.startsWith("/boletines") },
    { href: "/misiones", label: "Misiones", icon: TargetIcon, badge: pendingMissions, match: (p) => p.startsWith("/misiones") },
    { href: "/perfil", label: "Perfil", icon: UserIcon, match: (p) => p.startsWith("/perfil") },
  ];
  const onNotifications = path.startsWith("/notificaciones");

  return (
    <>
      {/* Celular: encabezado arriba y barra de tareas abajo. */}
      <header className="app-topbar">
        <Link href="/" className="font-display flex-1 text-lg font-extrabold text-white no-underline">
          {siteName}
        </Link>
        {isAdmin ? (
          <Link href="/admin" aria-label="Panel admin" className="app-topbar-btn">
            {GearIcon}
          </Link>
        ) : null}
        <Link
          href="/notificaciones"
          aria-label={unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
          aria-current={onNotifications ? "page" : undefined}
          className="app-topbar-btn relative"
        >
          {BellIcon}
          <Badge count={unread} className="absolute right-0.5 top-1" />
        </Link>
      </header>

      <nav aria-label="Principal" className="app-tabbar">
        {items.map((item) => {
          const active = item.match(path);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`app-tab ${active ? "is-active" : ""}`}>
              {item.icon}
              {item.label}
              <Badge count={item.badge} className="absolute right-3 top-0.5" />
            </Link>
          );
        })}
      </nav>

      {/* 768px o más: menú lateral. */}
      <aside className="win app-sidebar hidden md:block">
        <div className="win-titlebar">
          <span className="win-title">Inicio</span>
          <div className="win-btns" aria-hidden="true">
            <div className="win-btn">_</div>
            <div className="win-btn">□</div>
            <div className="win-btn close">×</div>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-3">
          <Link href="/" className="font-display px-1 text-lg font-extrabold leading-tight text-ink no-underline">
            {siteName}
          </Link>
          <nav aria-label="Principal" className="flex flex-col gap-1">
            {items.map((item) => {
              const active = item.match(path);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`app-side-link ${active ? "is-active" : ""}`}
                >
                  {item.icon}
                  {item.label === "Perfil" ? "Mi perfil" : item.label}
                  <Badge count={item.badge} className="ml-auto" />
                </Link>
              );
            })}
            <Link
              href="/notificaciones"
              aria-current={onNotifications ? "page" : undefined}
              className={`app-side-link ${onNotifications ? "is-active" : ""}`}
            >
              {BellIcon}
              Notificaciones
              <Badge count={unread} className="ml-auto" />
            </Link>
          </nav>
          <hr className="form-rule" />
          <div className="flex flex-col gap-1">
            {isAdmin ? (
              <Link
                href="/admin"
                aria-current={path.startsWith("/admin") ? "page" : undefined}
                className={`app-side-link !text-accent-pink-2 ${path.startsWith("/admin") ? "is-active" : ""}`}
              >
                {GearIcon}
                Panel admin
              </Link>
            ) : null}
            <div className="app-side-link">{signOut}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
