import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { EmailFrame } from "./email-frame";

export default async function NotificacionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await markSeen(session.user.id);

  const { id } = await params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== session.user.id) notFound();

  if (!notification.readAt) {
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
  // Las que no guardan el correo (boletín, reacciones) llevan a donde está el contenido.
  if (!notification.html) redirect(notification.url || "/notificaciones");

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex items-start justify-between gap-4 px-1">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              {notification.createdAt.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}
            </p>
            <h1 className="text-xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">{notification.title}</h1>
          </div>
          <Link href="/notificaciones" className="chip chip-blue shrink-0">
            ← Notificaciones
          </Link>
        </div>
        <EmailFrame html={notification.html} title={notification.title} />
      </div>
    </main>
  );
}
