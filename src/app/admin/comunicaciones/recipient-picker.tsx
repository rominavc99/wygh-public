"use client";

import { useState } from "react";

export function RecipientPicker({
  users,
  error,
  initialAudience = "all",
  initialSelected = [],
}: {
  users: { id: string; label: string }[];
  error?: string;
  initialAudience?: "all" | "selected";
  initialSelected?: string[];
}) {
  const [audience, setAudience] = useState<"all" | "selected">(initialAudience);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));

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
