import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { formatLocalDate, localDateOf } from "@/lib/date";
import { STRIKES_TO_BAN, missionText } from "@/lib/missions";
import { clearStrikes, createMission, deleteMission, toggleMission, updateMission } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  OFFERED: "Ofrecida",
  ACCEPTED: "Aceptada",
  COMPLETED: "Cumplida",
  FAILED: "Incumplida",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

export default async function AdminMisionesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const now = new Date();
  const [missions, penalized, recent] = await Promise.all([
    prisma.mission.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      include: { _count: { select: { assignments: { where: { status: "COMPLETED" } } } } },
    }),
    prisma.user.findMany({
      where: { OR: [{ missionStrikes: { gt: 0 } }, { missionBanUntil: { gt: now } }] },
      orderBy: { name: "asc" },
    }),
    prisma.missionAssignment.findMany({
      where: { status: { not: "OFFERED" } },
      include: { mission: true, user: true, target: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);
  const active = missions.filter((m) => m.active).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">🎯 Misiones</h2>
        <p className="text-sm text-ink-soft">
          {active} activa{active === 1 ? "" : "s"} de {missions.length}. Cada quien pide una al azar (o para alguien en
          específico) desde /misiones y la entrega en su resumen del día. Escribe <code>{"{usuario}"}</code> donde va el
          nombre de la persona.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-panel-edge bg-panel-2 px-4 py-2.5 text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}

      <form action={createMission} className="flex flex-col gap-2 rounded-xl border border-panel-edge bg-panel-2 p-4">
        <label htmlFor="new-mission" className="text-sm font-bold text-ink">
          Nueva misión
        </label>
        <textarea
          id="new-mission"
          name="text"
          rows={2}
          maxLength={300}
          required
          placeholder="Pregúntale a {usuario} cuál es su canción favorita y por qué."
          className="xp-textarea"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="requiresPhoto" className="h-4 w-4 accent-[var(--accent-pink)]" />
            Pide foto al entregarla
          </label>
          <button type="submit" className="xp-btn">
            Agregar
          </button>
        </div>
      </form>

      <ul className="flex flex-col gap-2">
        {missions.map((m) => (
          <li
            key={m.id}
            className={`flex flex-col gap-2 rounded-xl border p-3 ${m.active ? "border-panel-edge bg-panel-2" : "border-panel-edge bg-panel opacity-70"}`}
          >
            <form action={updateMission} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={m.id} />
              <textarea name="text" rows={2} maxLength={300} defaultValue={m.text} aria-label="Texto de la misión" className="xp-textarea" />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="requiresPhoto" defaultChecked={m.requiresPhoto} className="h-4 w-4 accent-[var(--accent-pink)]" />
                  Pide foto
                </label>
                <span className="text-xs text-ink-faint">
                  {m._count.assignments} cumplida{m._count.assignments === 1 ? "" : "s"}
                </span>
                {!m.active ? <span className="chip chip-neutral">Desactivada</span> : null}
                <span className="flex-1" />
                <button type="submit" className="xp-btn-secondary text-xs">
                  Guardar
                </button>
              </div>
            </form>
            <div className="flex flex-wrap justify-end gap-2">
              <form action={toggleMission}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className="xp-btn-secondary text-xs">
                  {m.active ? "Desactivar" : "Activar"}
                </button>
              </form>
              <form action={deleteMission}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className="xp-btn-danger text-xs" title="Si ya se usó, solo se desactiva">
                  Borrar
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-bold text-ink">⚠️ Advertencias</h3>
        {penalized.length ? (
          <ul className="flex flex-col gap-2">
            {penalized.map((u) => {
              const banned = u.missionBanUntil && u.missionBanUntil > now;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-panel-edge bg-panel-2 p-3 text-sm">
                  <span className="flex-1">
                    <strong>{displayName(u)}</strong> · {u.missionStrikes} de {STRIKES_TO_BAN} advertencias
                    {banned ? ` · fuera hasta el ${formatLocalDate(localDateOf(u.missionBanUntil!))}` : ""}
                  </span>
                  <form action={clearStrikes}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" className="xp-btn-secondary text-xs">
                      {banned ? "Levantar baneo" : "Quitar advertencias"}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Nadie tiene advertencias. 🦆</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-bold text-ink">🗂️ Últimas misiones</h3>
        {recent.length ? (
          <div className="overflow-x-auto rounded-xl border border-panel-edge">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-2 text-xs text-ink-soft">
                <tr>
                  <th className="px-3 py-2">Resumen del</th>
                  <th className="px-3 py-2">Quién → para quién</th>
                  <th className="px-3 py-2">Misión</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id} className="border-t border-panel-edge align-top">
                    <td className="whitespace-nowrap px-3 py-2">{a.date}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {displayName(a.user)} → {displayName(a.target)}
                    </td>
                    <td className="px-3 py-2">
                      {missionText(a.mission.text, a.target)}
                      {a.resolutionText ? <p className="mt-1 text-xs italic text-ink-soft">{a.resolutionText}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{STATUS_LABEL[a.status] ?? a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Todavía nadie ha aceptado una misión.</p>
        )}
      </section>
    </div>
  );
}
