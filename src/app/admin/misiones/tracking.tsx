import Link from "next/link";
import { displayName } from "@/lib/display-name";
import { formatLocalDate, localDateOf } from "@/lib/date";
import { STRIKES_TO_BAN, missionText } from "@/lib/missions";
import { DETAIL_LIMIT, FILTERS, count, missionTracking, type TrackingParams } from "@/lib/mission-tracking";
import type { MissionStatus } from "@/generated/prisma/enums";
import { clearStrikes } from "./actions";

// Seguimiento de misiones en /admin/misiones: lo activo ahora, por persona,
// por día y el detalle, con filtros por estado, persona y rango de fechas.
// Las fechas son las del resumen en que se entrega cada misión (el "día"
// de la misión, ver MissionAssignment.date). Los datos salen de
// src/lib/mission-tracking.ts (los comparte la API).

export type { TrackingParams };

const STATUS: Record<MissionStatus, { label: string; chip: string }> = {
  OFFERED: { label: "Ofrecida", chip: "chip-neutral" },
  ACCEPTED: { label: "Activa", chip: "chip-blue" },
  COMPLETED: { label: "Cumplida", chip: "chip-pink" },
  FAILED: { label: "Incumplida", chip: "chip-neutral" },
  REJECTED: { label: "Rechazada", chip: "chip-neutral" },
  CANCELLED: { label: "Cancelada", chip: "chip-neutral" },
};

export async function MissionTracking({ params }: { params: TrackingParams }) {
  const { desde, hasta, estado, usuario, users, activeNow, openOffers, period, detail, sendTime, done, failed, cancelled, closed, activeByUser, perUser, perDay } =
    await missionTracking(params);
  const filterHref = (changes: Partial<TrackingParams>) => {
    const q = new URLSearchParams({ estado, desde, hasta, ...(usuario ? { usuario } : {}), ...changes });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    return `/admin/misiones?${q}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-panel-edge bg-panel-2 p-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-ink-soft">
          Estado
          <select name="estado" defaultValue={estado} className="xp-select">
            {Object.entries(FILTERS).map(([key, f]) => (
              <option key={key} value={key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-ink-soft">
          Persona
          <select name="usuario" defaultValue={usuario} className="xp-select">
            <option value="">Todas</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {displayName(u)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-ink-soft">
          Desde
          <input type="date" name="desde" defaultValue={desde} className="xp-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-ink-soft">
          Hasta
          <input type="date" name="hasta" defaultValue={hasta} className="xp-input" />
        </label>
        <button type="submit" className="xp-btn-secondary">
          Filtrar
        </button>
        <Link href="/admin/misiones" className="text-xs font-bold text-chrome-4 underline">
          Quitar filtros
        </Link>
      </form>
      <p className="-mt-3 text-xs text-ink-faint">
        Las fechas son las del boletín en el que se entrega cada misión (el resumen es del día anterior). Persona =
        quien la hizo o para quien era.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Activas ahora", activeNow.length, "aceptadas sin entregar"],
          ["Cumplidas", done, `${closed ? Math.round((done / closed) * 100) : 0}% de las concluidas`],
          ["Incumplidas", failed, "sumaron advertencia"],
          ["Canceladas", cancelled, `${count(period, (a) => a.status === "REJECTED")} rechazadas · ${openOffers} ofertas abiertas`],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded-xl border border-panel-edge bg-panel-2 p-3">
            <p className="text-xs font-bold text-ink-soft">{label}</p>
            <p className="font-display text-2xl font-bold text-ink">{value}</p>
            <p className="text-[11px] text-ink-faint">{hint}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold text-ink">🟢 Activas ahora, por persona</h3>
        {activeByUser.size ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...activeByUser.values()].map((rows) => {
              const u = rows[0].user;
              return (
                <div key={u.id} className="rounded-xl border border-panel-edge bg-panel-2 p-3">
                  <p className="mb-2 flex flex-wrap items-center gap-2">
                    <Link href={filterHref({ usuario: u.id })} className="font-display font-bold text-accent-pink-2 no-underline hover:underline">
                      {displayName(u)}
                    </Link>
                    <span className="chip chip-blue text-[11px]">{rows.length} activa{rows.length === 1 ? "" : "s"}</span>
                    {u.missionStrikes ? (
                      <span className="chip chip-neutral text-[11px]">
                        ⚠️ {u.missionStrikes}/{STRIKES_TO_BAN}
                      </span>
                    ) : null}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {rows.map((a) => (
                      <li key={a.id} className="rounded-lg border border-panel-edge bg-panel p-2 text-sm">
                        <p className="text-ink">
                          <strong>Para {displayName(a.target)}:</strong> {missionText(a.mission.text, a.target)}
                          {a.mission.requiresPhoto ? " 📷" : ""}
                        </p>
                        <p className="mt-1 text-xs text-ink-soft">
                          Entrega antes del boletín del {formatLocalDate(a.date)} ({sendTime})
                          {a.acceptedAt ? ` · aceptada ${a.acceptedAt.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                          {a.swaps ? ` · ${a.swaps} cambio${a.swaps === 1 ? "" : "s"} de actividad` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Nadie tiene misiones activas ahorita.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-bold text-ink">👥 Por persona</h3>
        {perUser.length ? (
          <div className="overflow-x-auto rounded-xl border border-panel-edge">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-2 text-xs text-ink-soft">
                <tr>
                  <th className="px-3 py-2">Persona</th>
                  <th className="px-2 py-2 text-right">Aceptadas</th>
                  <th className="px-2 py-2 text-right">Activas</th>
                  <th className="px-2 py-2 text-right">Cumplidas</th>
                  <th className="px-2 py-2 text-right">Incumplidas</th>
                  <th className="px-2 py-2 text-right">Canceladas</th>
                  <th className="px-2 py-2 text-right">Rechazadas</th>
                  <th className="px-2 py-2 text-right">Hechas para</th>
                  <th className="px-3 py-2">Advertencias</th>
                </tr>
              </thead>
              <tbody>
                {perUser.map((r) => (
                  <tr key={r.user.id} className="border-t border-panel-edge align-top">
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link href={filterHref({ usuario: r.user.id })} className="font-bold text-ink no-underline hover:underline">
                        {displayName(r.user)}
                      </Link>
                      {r.user.missionOptOut ? <p className="text-[11px] text-ink-faint">no participa como persona</p> : null}
                    </td>
                    <td className="px-2 py-2 text-right">{r.accepted}</td>
                    <td className="px-2 py-2 text-right">{r.active}</td>
                    <td className="px-2 py-2 text-right">{r.done}</td>
                    <td className="px-2 py-2 text-right">{r.failed}</td>
                    <td className="px-2 py-2 text-right">{r.cancelled}</td>
                    <td className="px-2 py-2 text-right">{r.rejected}</td>
                    <td className="px-2 py-2 text-right">{r.forThem}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                        <span>
                          {r.user.missionStrikes}/{STRIKES_TO_BAN}
                          {r.banned ? ` · fuera hasta el ${formatLocalDate(localDateOf(r.user.missionBanUntil!))}` : ""}
                        </span>
                        {r.user.missionStrikes || r.banned ? (
                          <form action={clearStrikes}>
                            <input type="hidden" name="userId" value={r.user.id} />
                            <button type="submit" className="xp-btn-secondary px-2 py-1 text-[11px]">
                              {r.banned ? "Levantar baneo" : "Quitar"}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Nadie tuvo misiones en este periodo.</p>
        )}
        <p className="text-[11px] text-ink-faint">&quot;Hechas para&quot; = misiones cumplidas que otros hicieron para esa persona.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-bold text-ink">📅 Por día</h3>
        {perDay.length ? (
          <div className="overflow-x-auto rounded-xl border border-panel-edge">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-2 text-xs text-ink-soft">
                <tr>
                  <th className="px-3 py-2">Boletín del</th>
                  <th className="px-2 py-2 text-right">Activas</th>
                  <th className="px-2 py-2 text-right">Cumplidas</th>
                  <th className="px-2 py-2 text-right">Incumplidas</th>
                  <th className="px-2 py-2 text-right">Canceladas</th>
                  <th className="px-2 py-2 text-right">Rechazadas</th>
                </tr>
              </thead>
              <tbody>
                {perDay.map((d) => (
                  <tr key={d.date} className="border-t border-panel-edge">
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link href={filterHref({ desde: d.date, hasta: d.date })} className="text-ink no-underline hover:underline">
                        {formatLocalDate(d.date)}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right">{d.active}</td>
                    <td className="px-2 py-2 text-right">{d.done}</td>
                    <td className="px-2 py-2 text-right">{d.failed}</td>
                    <td className="px-2 py-2 text-right">{d.cancelled}</td>
                    <td className="px-2 py-2 text-right">{d.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">No hubo misiones en este periodo.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-bold text-ink">
          🗂️ Detalle · {FILTERS[estado].label.toLowerCase()} ({detail.length > DETAIL_LIMIT ? `${DETAIL_LIMIT}+` : detail.length})
        </h3>
        {detail.length ? (
          <ul className="flex flex-col gap-2">
            {detail.slice(0, DETAIL_LIMIT).map((a) => (
              <li key={a.id} className="rounded-xl border border-panel-edge bg-panel-2 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`chip ${STATUS[a.status].chip} text-[11px]`}>{STATUS[a.status].label}</span>
                  <span className="font-bold text-ink">
                    {displayName(a.user)} → {displayName(a.target)}
                  </span>
                  <span className="text-xs text-ink-faint">
                    Boletín del {formatLocalDate(a.date)} · {a.mode === "chosen" ? "eligió a la persona" : "al azar"}
                  </span>
                </div>
                <p className="mt-1 text-ink">
                  {missionText(a.mission.text, a.target)}
                  {a.mission.requiresPhoto ? " 📷" : ""}
                </p>
                {a.resolutionText ? <p className="mt-1 whitespace-pre-line italic text-ink-soft">{a.resolutionText}</p> : null}
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {a.photoFilename ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/${a.photoFilename}`} alt="" className="h-16 w-16 rounded-lg border border-panel-edge object-cover" />
                  ) : null}
                  {a.status === "COMPLETED" && a.response ? (
                    <Link href={`/boletines?date=${a.response.date}#mision-${a.id}`} className="text-xs font-bold text-chrome-4 underline">
                      Ver en el boletín
                    </Link>
                  ) : null}
                  {a.closedAt && a.status !== "COMPLETED" ? (
                    <span className="text-xs text-ink-faint">
                      {STATUS[a.status].label} el {a.closedAt.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">No hay misiones con estos filtros.</p>
        )}
      </section>
    </div>
  );
}
