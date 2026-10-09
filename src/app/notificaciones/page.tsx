import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { markAllNotificationsRead } from "./actions";

const PAGE_SIZE = 50;

function when(date: Date): string {
  return date.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function NotificacionesPage({ searchParams }: { searchParams: Promise<{ mas?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await markSeen(session.user.id);

  const params = await searchParams;
  const limit = params.mas ? PAGE_SIZE * 4 : PAGE_SIZE;
  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, preview: true, createdAt: true, readAt: true },
    }),
    prisma.notification.count({ where: { userId: session.user.id } }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
  ]);

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-5 flex items-start justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              Lo que te ha llegado por correo
            </p>
            <h1 className="text-2xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">Notificaciones</h1>
          </div>
          <Link href="/" className="chip chip-blue">
            ← Volver al formulario
          </Link>
        </div>

        <div className="win">
          <div className="win-titlebar">
            <span className="win-icon">🔔</span>
            <span className="win-title">Notificaciones</span>
            <div className="win-btns">
              <div className="win-btn">_</div>
              <div className="win-btn">□</div>
              <Link href="/" className="win-btn close" aria-label="Volver al formulario">
                ×
              </Link>
            </div>
          </div>
          <div className="win-toolbar flex items-center justify-between gap-2">
            <span>{unread ? `${unread} sin leer` : "Todo leído ✨"}</span>
            {unread ? (
              <form action={markAllNotificationsRead}>
                <button type="submit" className="whitespace-nowrap hover:text-chrome-4">
                  ✓ Marcar todo como leído
                </button>
              </form>
            ) : null}
          </div>

          <div className="win-body">
            {notifications.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Todavía no tienes notificaciones. Aquí vas a ver los correos que te mandemos: el boletín, las
                reacciones a tus respuestas, los resúmenes y demás.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/notificaciones/${n.id}`}
                      className={`block rounded-xl border px-3 py-2.5 hover:border-chrome-3 ${
                        n.readAt ? "border-panel-edge bg-panel" : "border-accent-pink bg-[var(--bubble-2)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm text-ink ${n.readAt ? "" : "font-bold"}`}>
                          {n.readAt ? null : <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent-pink align-middle" aria-label="Sin leer" />}
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[11px] text-ink-faint">{when(n.createdAt)}</span>
                      </div>
                      {n.preview ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{n.preview}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {total > notifications.length && !params.mas ? (
              <Link href="/notificaciones?mas=1" className="mt-4 inline-block text-sm font-bold text-accent-pink-2 underline">
                Ver más
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
