import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";
import { LeaveGroupButton } from "./leave-group-button";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await markSeen(session.user.id);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      username: true,
      birthday: true,
      greetingEmoji: true,
      groupMemberships: { include: { group: { select: { id: true, name: true, suspended: true } } }, orderBy: { group: { name: "asc" } } },
    },
  });
  const groups = user.groupMemberships.map((m) => m.group);

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-5 flex items-start justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              Cuenta
            </p>
            <h1 className="text-2xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              Mi perfil
            </h1>
          </div>
          <Link href="/" className="chip chip-blue">
            ← Volver al formulario
          </Link>
        </div>

        <div className="win">
          <div className="win-titlebar">
            <span className="win-icon">👤</span>
            <span className="win-title">Mi perfil</span>
            <div className="win-btns">
              <div className="win-btn">_</div>
              <div className="win-btn">□</div>
              <Link href="/" className="win-btn close" aria-label="Volver al formulario">
                ×
              </Link>
            </div>
          </div>
          <div className="win-toolbar">
            <span>📁 Archivo</span>
            <span>✏️ Editar</span>
          </div>

          <div className="win-body">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-ink">Nombre</label>
                <p className="xp-input opacity-70">{user.name}</p>
                <p className="text-xs text-ink-faint">Tu nombre lo administra el admin del boletín.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-ink">Correo</label>
                <p className="xp-input opacity-70">{user.email}</p>
              </div>
              <ProfileForm username={user.username} birthday={user.birthday} greetingEmoji={user.greetingEmoji} />

              <div className="flex flex-col gap-1.5 border-t border-panel-edge pt-4">
                <label className="text-sm font-bold text-ink">🫂 Mis grupos</label>
                {groups.length ? (
                  <ul className="flex flex-col gap-2">
                    {groups.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2 text-sm text-ink">
                        <span>
                          {g.name}
                          {g.suspended ? <span className="ml-1 text-xs text-ink-faint">(en pausa)</span> : null}
                        </span>
                        <LeaveGroupButton groupId={g.id} groupName={g.name} isLast={groups.length === 1} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-soft">Todavía no estás en ningún grupo.</p>
                )}
                <p className="text-xs text-ink-faint">
                  Si te sales de uno, para volver necesitas su enlace de invitación o que un admin te agregue.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
