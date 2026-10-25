"use client";

import Link from "next/link";
import { useActionState } from "react";
import { joinGroup } from "./actions";

export function JoinButton({ token, groupName }: { token: string; groupName: string }) {
  const [state, formAction, pending] = useActionState(joinGroup.bind(null, token), null);

  if (state?.status === "joined" || state?.status === "already") {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-lg font-bold text-accent-pink-2">
          {state.status === "joined" ? `¡Listo! Ya estás en ${state.groupName}. 🎉` : `Ya estabas en ${state.groupName}.`}
        </p>
        <Link href="/" className="xp-btn">
          Ir a responder →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      <button type="submit" disabled={pending} className="xp-btn">
        {pending ? "Uniéndote…" : `Unirme a ${groupName}`}
      </button>
      {state?.status === "invalid" ? <p className="text-sm text-danger">Este enlace ya no sirve. Pide uno nuevo.</p> : null}
      {state?.status === "suspended" ? <p className="text-sm text-danger">Este grupo está en pausa por ahora.</p> : null}
    </form>
  );
}
