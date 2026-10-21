"use client";

import { useActionState } from "react";
import {
  setExtraordinaryEnabled,
  addExtraordinaryGrant,
  removeExtraordinaryGrant,
  type ExtraordinaryState,
} from "./actions";

const initialState: ExtraordinaryState = { status: "idle" };

type Grant = {
  id: string;
  userName: string;
  date: string;
  dateLabel: string;
  notifiedAt: string | null;
  usedAt: string | null;
};

/**
 * Respuestas extraordinarias: el interruptor de la página y los permisos
 * de un solo uso por persona y día (ver src/lib/extraordinary.ts). Va
 * fuera del formulario de Ajustes porque manda correos al guardar.
 */
export function ExtraordinarySection({
  enabled,
  url,
  users,
  grants,
  yesterday,
}: {
  enabled: boolean;
  url: string;
  users: { id: string; name: string }[];
  grants: Grant[];
  yesterday: string;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(setExtraordinaryEnabled, initialState);
  const [addState, addAction, addPending] = useActionState(addExtraordinaryGrant, initialState);
  const pending = grants.filter((g) => !g.usedAt);
  const used = grants.filter((g) => g.usedAt);

  return (
    <div className="flex max-w-lg flex-col gap-4 rounded-xl border border-panel-edge bg-panel-2 p-4">
      <div>
        <h3 className="text-base font-bold text-ink">👑 Respuestas extraordinarias</h3>
        <p className="text-xs text-ink-faint">
          Para cuando a alguien la app le falló y no pudo responder un día. Le das un privilegio de un solo uso para
          ese día y lo responde en{" "}
          <a href={url} target="_blank" className="underline">
            {url}
          </a>
          . No se vuelve a mandar el boletín: la respuesta aparece en /boletines y al resto del grupo le llega
          &quot;Hay actualizaciones en el boletín del día…&quot; (a los admins, con el nombre).
        </p>
      </div>

      <form action={toggleAction} className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={enabled}
            className="h-4 w-4 accent-[var(--accent-pink)]"
          />
          Habilitar respuestas extraordinarias
        </label>
        <p className="ml-6 text-xs text-ink-faint">
          Al habilitarla, a quien tenga un privilegio pendiente le llega el correo de &quot;privilegio especial&quot;.
        </p>
        <button type="submit" disabled={togglePending} className="xp-btn-secondary ml-6 w-fit">
          {togglePending ? "Guardando…" : "Guardar"}
        </button>
        {toggleState.status === "done" ? (
          <p role="status" className={`ml-6 text-xs font-bold ${toggleState.ok ? "text-accent-pink-2" : "text-danger"}`}>
            {toggleState.message}
          </p>
        ) : null}
      </form>

      <form action={addAction} className="flex flex-col gap-2 rounded-lg border border-panel-edge bg-panel p-2.5">
        <p className="text-sm font-bold text-ink">Dar un privilegio</p>
        <div className="flex flex-wrap items-center gap-2">
          <select name="userId" defaultValue="" required className="xp-input w-auto" aria-label="A quién">
            <option value="">Elige a quién…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <input type="date" name="date" max={yesterday} required className="xp-input w-auto" aria-label="Día" />
          <button type="submit" disabled={addPending} className="xp-btn-secondary">
            {addPending ? "Guardando…" : "👑 Dar privilegio"}
          </button>
        </div>
        {addState.status === "done" ? (
          <p role="status" className={`text-xs font-bold ${addState.ok ? "text-accent-pink-2" : "text-danger"}`}>
            {addState.message}
          </p>
        ) : null}
      </form>

      {pending.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-ink">Pendientes</p>
          <ul className="flex flex-col gap-1">
            {pending.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                <span>
                  <strong>{g.userName}</strong> · {g.dateLabel}{" "}
                  <span className="text-xs text-ink-faint">{g.notifiedAt ? "(avisado)" : "(sin avisar todavía)"}</span>
                </span>
                <form action={removeExtraordinaryGrant}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" className="text-xs text-danger underline">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {used.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-ink">Ya usados</p>
          <ul className="flex flex-col gap-1">
            {used.map((g) => (
              <li key={g.id} className="text-sm text-ink">
                <strong>{g.userName}</strong> ·{" "}
                <a href={`/boletines?date=${g.date}`} className="underline">
                  {g.dateLabel}
                </a>{" "}
                <span className="text-xs text-ink-faint">(respondió el {g.usedAt})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
