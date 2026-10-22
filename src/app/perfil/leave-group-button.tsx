"use client";

import { leaveGroup } from "./actions";

/** Pide confirmación antes de salirse: volver requiere el enlace o a un admin. */
export function LeaveGroupButton({ groupId, groupName, isLast }: { groupId: string; groupName: string; isLast: boolean }) {
  return (
    <form
      action={leaveGroup}
      onSubmit={(e) => {
        const warning = isLast ? "\n\nEs tu único grupo: ya no podrás mandar respuestas hasta que entres a otro." : "";
        if (!window.confirm(`¿Salirte de ${groupName}? Dejarás de recibir su boletín.${warning}`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <button type="submit" className="xp-btn-secondary text-xs">
        Salirme
      </button>
    </form>
  );
}
