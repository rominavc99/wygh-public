"use client";

import { useActionState, useState } from "react";
import { updateUser, toggleUserActive, type UserFormState } from "./actions";
import type { Role } from "@/generated/prisma/enums";
import { avatarGradient } from "@/lib/avatar";

type User = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: Role;
  active: boolean;
};

const initialState: UserFormState = { status: "idle" };

export function UserRow({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateUser, initialState);
  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};

  if (state.status === "success" && editing) {
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-3 rounded-xl border border-panel-edge bg-panel-2 p-4">
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={user.id} />
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-bold text-ink-soft">Nombre</label>
            <input name="name" defaultValue={user.name} className="xp-input" required />
            {fieldErrors.name ? <p className="text-xs text-danger">{fieldErrors.name}</p> : null}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-bold text-ink-soft">Correo</label>
            <input name="email" type="email" defaultValue={user.email} className="xp-input" required />
            {fieldErrors.email ? <p className="text-xs text-danger">{fieldErrors.email}</p> : null}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-bold text-ink-soft">Usuario (opcional)</label>
            <input name="username" defaultValue={user.username ?? ""} className="xp-input" placeholder="Apodo para el boletín" />
            {fieldErrors.username ? <p className="text-xs text-danger">{fieldErrors.username}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-ink-soft">Rol</label>
            {isSelf ? (
              <>
                {/* Un <select disabled> no se manda en el FormData, así que se
                    fija el rol actual con un input oculto: evita que te quites
                    el admin a ti mismo sin romper el envío del resto del form. */}
                <input type="hidden" name="role" value={user.role} />
                <p className="xp-input opacity-70">{user.role === "ADMIN" ? "Admin" : "Miembro"}</p>
              </>
            ) : (
              <select name="role" defaultValue={user.role} className="xp-select">
                <option value="MEMBER">Miembro</option>
                <option value="ADMIN">Admin</option>
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="xp-btn">
              Guardar
            </button>
            <button type="button" onClick={() => setEditing(false)} className="xp-btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
        {state.status === "error" ? (
          <p className="text-xs text-danger">{state.message ?? "No se pudo guardar. Revisa los campos."}</p>
        ) : null}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-panel-edge bg-panel-2 p-4">
      <div className="flex items-center gap-3">
        <div className="avatar" style={{ background: avatarGradient(user.name) }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-ink">
            {user.name}{" "}
            {user.username ? <span className="chip chip-blue ml-1">@{user.username}</span> : null}
            {user.role === "ADMIN" ? <span className="chip chip-pink ml-1">Admin</span> : null}
            {!user.active ? <span className="chip chip-neutral ml-1">Inactivo</span> : null}
          </p>
          <p className="text-sm text-ink-soft">{user.email}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setEditing(true)} className="xp-btn-secondary">
          Editar
        </button>
        {!isSelf ? (
          <form action={toggleUserActive}>
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="nextActive" value={(!user.active).toString()} />
            <button type="submit" className={user.active ? "xp-btn-danger" : "xp-btn-secondary"}>
              {user.active ? "Desactivar" : "Activar"}
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
