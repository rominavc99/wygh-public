import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createMission, deleteMission, toggleMission, updateMission } from "./actions";
import { MissionTracking, type TrackingParams } from "./tracking";

export default async function AdminMisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; vista?: string } & TrackingParams>;
}) {
  const params = await searchParams;
  const { error } = params;
  const catalog = params.vista === "catalogo";
  const missions = await prisma.mission.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { assignments: { where: { status: "COMPLETED" } } } } },
  });
  const active = missions.filter((m) => m.active).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">🎯 Misiones</h2>
        <p className="text-sm text-ink-soft">
          Cada quien pide una misión al azar (o para alguien en específico) desde /misiones y la entrega en su resumen
          del día. En Seguimiento ves qué tiene cada quien; en Catálogo, las misiones que se pueden ofrecer.
        </p>
      </div>

      <nav aria-label="Secciones de misiones" className="flex flex-wrap gap-2">
        <Link href="/admin/misiones" aria-current={!catalog ? "page" : undefined} className={`chip ${!catalog ? "chip-pink" : "chip-neutral"} no-underline`}>
          📊 Seguimiento
        </Link>
        <Link
          href="/admin/misiones?vista=catalogo"
          aria-current={catalog ? "page" : undefined}
          className={`chip ${catalog ? "chip-pink" : "chip-neutral"} no-underline`}
        >
          📚 Catálogo ({missions.length})
        </Link>
      </nav>

      {!catalog ? <MissionTracking params={params} /> : null}

      {error ? (
        <p role="alert" className="rounded-lg border border-panel-edge bg-panel-2 px-4 py-2.5 text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}

      {catalog ? (
        <>
          <p className="text-sm text-ink-soft">
            {active} de {missions.length} misiones del catálogo están activas (se pueden ofrecer). Escribe{" "}
            <code>{"{usuario}"}</code> donde va el nombre de la persona.
          </p>
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

        </>
      ) : null}
    </div>
  );
}
