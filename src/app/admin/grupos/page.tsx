import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CreateGroupForm } from "./group-forms";

export default async function GruposPage() {
  const groups = await prisma.group.findMany({
    orderBy: [{ suspended: "asc" }, { name: "asc" }],
    include: { _count: { select: { members: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">🫂 Grupos</h2>
        <p className="text-sm text-ink-soft">
          Cada grupo tiene su propio boletín y no ve lo de los demás. Una persona puede estar en varios y, al
          responder, elige a cuáles manda su respuesta.
        </p>
      </div>

      <CreateGroupForm />

      <ul className="flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              href={`/admin/grupos/${group.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-panel-edge bg-panel-2 p-4 hover:border-accent-pink-2"
            >
              <div>
                <p className="font-bold text-ink">
                  {group.name}
                  {group.suspended ? <span className="chip chip-neutral ml-2">En pausa</span> : null}
                  {group.inviteToken ? <span className="chip chip-blue ml-2">🔗 Enlace activo</span> : null}
                </p>
                <p className="text-sm text-ink-soft">
                  {group._count.members} miembro{group._count.members === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-sm font-bold text-ink-soft">Gestionar →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
