"use client";

import { cancelAccepted } from "./actions";

/** Pide confirmación antes de cancelar: cada semana solo se pueden unas pocas. */
export function CancelMissionButton({ assignmentId, cancelsLeft }: { assignmentId: string; cancelsLeft: number }) {
  return (
    <form
      action={cancelAccepted}
      onSubmit={(e) => {
        const left = cancelsLeft - 1;
        const note = left > 0 ? `Te quedaría ${left} cancelación esta semana.` : "Es tu última cancelación de esta semana.";
        if (!window.confirm(`¿Cancelar esta misión? No cuenta como advertencia, pero se le avisa al admin.\n\n${note}`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <button type="submit" className="xp-btn-danger min-h-11" disabled={cancelsLeft <= 0}>
        Cancelar
      </button>
    </form>
  );
}
