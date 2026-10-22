import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AddUserForm } from "./add-user-form";
import { UserRow } from "./user-row";

export default async function UsuariosPage() {
  const session = await auth();
  const [users, groups] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: { groupMemberships: { include: { group: { select: { name: true } } } } },
    }),
    prisma.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, suspended: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">👥 Usuarios</h2>
        <p className="text-sm text-ink-soft">
          {users.length} persona{users.length === 1 ? "" : "s"} registrada
          {users.length === 1 ? "" : "s"}.
        </p>
      </div>

      <AddUserForm groups={groups} />

      <ul className="flex flex-col gap-2">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            groupNames={user.groupMemberships.map((m) => m.group.name).sort()}
            isSelf={user.id === session?.user.id}
          />
        ))}
      </ul>
    </div>
  );
}
