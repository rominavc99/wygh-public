"use client";

import { useState } from "react";

type Audience = "all" | "selected" | "groups";

export function RecipientPicker({
  users,
  groups,
  error,
  initialAudience = "all",
  initialSelected = [],
}: {
  users: { id: string; label: string }[];
  groups: { id: string; label: string }[];
  error?: string;
  initialAudience?: Audience;
  /** Ids de personas ("selected") o de grupos ("groups"). */
  initialSelected?: string[];
}) {
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialAudience === "selected" ? initialSelected : []));
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    () => new Set(initialAudience === "groups" ? initialSelected : [])
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-bold text-ink">Destinatarios</label>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          type="radio"
          name="audience"
          value="all"
          checked={audience === "all"}
          onChange={() => setAudience("all")}
        />
        Todos los usuarios activos
      </label>
      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          type="radio"
          name="audience"
          value="selected"
          checked={audience === "selected"}
          onChange={() => setAudience("selected")}
        />
        Elegir personas específicas
      </label>
      {groups.length > 1 ? (
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input
            type="radio"
            name="audience"
            value="groups"
            checked={audience === "groups"}
            onChange={() => setAudience("groups")}
          />
          Los miembros de ciertos grupos
        </label>
      ) : null}

      {audience === "groups" ? (
        <div className="flex flex-col gap-1 rounded-lg border border-panel-edge bg-white p-2">
          {groups.map((group) => (
            <label key={group.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm text-ink hover:bg-panel-2">
              <input
                type="checkbox"
                name="groupIds"
                value={group.id}
                checked={selectedGroups.has(group.id)}
                onChange={() =>
                  setSelectedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.id)) next.delete(group.id);
                    else next.add(group.id);
                    return next;
                  })
                }
              />
              🫂 {group.label}
            </label>
          ))}
        </div>
      ) : null}

      {audience === "selected" ? (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-panel-edge bg-white p-2">
          {users.map((user) => (
            <label key={user.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm text-ink hover:bg-panel-2">
              <input
                type="checkbox"
                name="recipientIds"
                value={user.id}
                checked={selected.has(user.id)}
                onChange={() => toggle(user.id)}
              />
              {user.label}
            </label>
          ))}
          {users.length === 0 ? <p className="text-xs text-ink-faint">No hay usuarios activos.</p> : null}
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
