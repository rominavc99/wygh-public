import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { inviteUrl } from "@/lib/groups";
import { avatarGradient } from "@/lib/avatar";
import { setGroupSuspended, setInviteLink, removeGroupMember } from "../actions";
import { RenameGroupForm, PeoplePickerForm, CopyLinkButton } from "../group-forms";

export default async function GrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await prisma.group.findUnique({
    where: { id },
    include: { members: { include: { user: true }, orderBy: { user: { name: "asc" } } } },
  });
  if (!group) notFound();

  const memberIds = new Set(group.members.map((m) => m.userId));
  const others = (await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }))
    .filter((u) => !memberIds.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/grupos" className="text-xs font-bold text-ink-soft hover:text-accent-pink-2">
            ← Todos los grupos
          </Link>
          <h2 className="text-xl font-bold text-ink">
            🫂 {group.name}
            {group.suspended ? <span className="chip chip-neutral ml-2 align-middle">En pausa</span> : null}
          </h2>
          <p className="text-sm text-ink-soft">
            {group.members.length} miembro{group.members.length === 1 ? "" : "s"}
          </p>
        </div>
        <form action={setGroupSuspended}>
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="suspended" value={(!group.suspended).toString()} />
          <button type="submit" className={group.suspended ? "xp-btn" : "xp-btn-danger"}>
            {group.suspended ? "▶ Reactivar" : "⏸ Suspender"}
          </button>
        </form>
      </div>

      {group.suspended ? (
        <p className="rounded-lg border border-panel-edge bg-panel-2 px-4 py-2.5 text-sm text-ink-soft">
          En pausa: no se envía su boletín ni su recordatorio, no aparece al responder y no se puede entrar con el
          enlace. Sus miembros siguen viendo el historial.
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-panel-edge bg-panel-2 p-5">
        <RenameGroupForm groupId={group.id} name={group.name} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-panel-edge bg-panel-2 p-5">
        <div>
          <h3 className="font-bold text-ink">🔗 Enlace para unirse</h3>
          <p className="text-xs text-ink-soft">
            Cualquier persona con cuenta que lo abra puede unirse. Si lo regeneras, el anterior deja de servir.
          </p>
        </div>
        {group.inviteToken ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input readOnly value={inviteUrl(group.inviteToken)} className="xp-input flex-1 text-xs" />
              <CopyLinkButton url={inviteUrl(group.inviteToken)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={setInviteLink}>
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="mode" value="regenerate" />
                <button type="submit" className="xp-btn-secondary">
                  🔄 Regenerar
                </button>
              </form>
              <form action={setInviteLink}>
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="mode" value="disable" />
                <button type="submit" className="xp-btn-danger">
                  Desactivar enlace
                </button>
              </form>
            </div>
          </>
        ) : (
          <form action={setInviteLink}>
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="mode" value="enable" />
            <button type="submit" className="xp-btn-secondary">
              Crear enlace
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-panel-edge bg-panel-2 p-5">
        <div>
          <h3 className="font-bold text-ink">✉️ Invitar amigos</h3>
          <p className="text-xs text-ink-soft">
            Les llega un correo con el enlace para unirse; quedan en el grupo cuando lo aceptan.
            {group.inviteToken ? "" : " Si el enlace está desactivado, se crea uno al invitar."}
          </p>
        </div>
        <PeoplePickerForm groupId={group.id} people={others} mode="invite" />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-panel-edge bg-panel-2 p-5">
        <h3 className="font-bold text-ink">👥 Miembros</h3>
        {group.members.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no hay nadie en este grupo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {group.members.map(({ user }) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="avatar" style={{ background: avatarGradient(user.name) }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">
                      {user.name}
                      {!user.active ? <span className="chip chip-neutral ml-1">Inactivo</span> : null}
                    </p>
                    <p className="text-xs text-ink-soft">{user.email}</p>
                  </div>
                </div>
                <form action={removeGroupMember}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="userId" value={user.id} />
                  <button type="submit" className="xp-btn-secondary text-xs">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-bold text-ink-soft hover:text-accent-pink-2">
            ➕ Agregar manualmente (sin invitación)
          </summary>
          <div className="mt-2">
            <PeoplePickerForm groupId={group.id} people={others} mode="add" />
          </div>
        </details>
      </section>
    </div>
  );
}
