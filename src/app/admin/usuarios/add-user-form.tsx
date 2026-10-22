"use client";

import { useActionState, useRef, useEffect } from "react";
import { createUser, type UserFormState } from "./actions";

const initialState: UserFormState = { status: "idle" };

type GroupOption = { id: string; name: string; suspended: boolean };

export function AddUserForm({ groups }: { groups: GroupOption[] }) {
  const [state, formAction, pending] = useActionState(createUser, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-panel-edge bg-panel-2 p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-bold text-ink">Nombre</label>
          <input name="name" className="xp-input" required />
          {fieldErrors.name ? <p className="text-xs text-danger">{fieldErrors.name}</p> : null}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-bold text-ink">Correo</label>
          <input name="email" type="email" className="xp-input" required />
          {fieldErrors.email ? <p className="text-xs text-danger">{fieldErrors.email}</p> : null}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-bold text-ink">Usuario (opcional)</label>
          <input name="username" className="xp-input" placeholder="Apodo para el boletín" />
          {fieldErrors.username ? <p className="text-xs text-danger">{fieldErrors.username}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-bold text-ink">Rol</label>
          <select name="role" defaultValue="MEMBER" className="xp-select">
            <option value="MEMBER">Miembro</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button type="submit" disabled={pending} className="xp-btn h-fit">
          {pending ? "Agregando…" : "Agregar +"}
        </button>
      </div>
      {groups.length ? (
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <legend className="mb-1 text-sm font-bold text-ink">Grupos</legend>
          {groups.map((group) => (
            <label key={group.id} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="checkbox" name="groupIds" value={group.id} defaultChecked={!group.suspended} />
              {group.name}
              {group.suspended ? <span className="text-xs text-ink-faint">(en pausa)</span> : null}
            </label>
          ))}
        </fieldset>
      ) : null}
    </form>
  );
}
