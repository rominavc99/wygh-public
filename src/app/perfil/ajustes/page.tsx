import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "../profile-form";
import { LeaveGroupButton } from "../leave-group-button";
import { setMissionOptOut } from "../actions";

/** Ajustes de la cuenta propia (antes iban al final de /perfil). */
export default async function AjustesPerfilPage() {
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
      missionOptOut: true,
      groupMemberships: { include: { group: { select: { id: true, name: true, suspended: true } } }, orderBy: { group: { name: "asc" } } },
    },
  });
  const groups = user.groupMemberships.map((m) => m.group);

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-8 sm:py-10">
      <div className="flex w-full max-w-2xl flex-col gap-5">
        <Link href="/perfil" className="chip chip-blue min-h-10 self-start no-underline">
          ← Volver a mi perfil
        </Link>

        <div className="win">
          <div className="win-titlebar">
            <span className="win-icon">⚙️</span>
            <h1 className="win-title">Ajustes de perfil</h1>
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

              <form action={setMissionOptOut} className="flex flex-col gap-2 border-t border-panel-edge pt-4">
                <span className="text-sm font-bold text-ink">🎯 Misiones</span>
                <label className="flex min-h-8 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="optOut"
                    defaultChecked={user.missionOptOut}
                    className="h-5 w-5 accent-[var(--accent-pink)]"
                  />
                  No quiero salir como persona en las misiones de otros
                </label>
                <p className="text-xs text-ink-faint">Tú sí puedes seguir pidiendo misiones para los demás.</p>
                <button type="submit" className="xp-btn-secondary self-start text-xs">
                  Guardar
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
