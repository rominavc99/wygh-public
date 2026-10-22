"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createGroup, renameGroup, addGroupMembers, inviteToGroup, type GroupFormState } from "./actions";

const initialState: GroupFormState = { status: "idle" };

function StateMessage({ state }: { state: GroupFormState }) {
  if (state.status === "error") return <p className="text-xs text-danger">{state.message}</p>;
  if (state.status === "success" && state.message) return <p className="text-xs font-bold text-accent-pink-2">{state.message}</p>;
  return null;
}

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-panel-edge bg-panel-2 p-5">
      <label className="text-sm font-bold text-ink">Nuevo grupo</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="name" className="xp-input flex-1" placeholder="Nombre del grupo" maxLength={60} required />
        <button type="submit" disabled={pending} className="xp-btn h-fit">
          {pending ? "Creando…" : "Crear +"}
        </button>
      </div>
      <StateMessage state={state} />
    </form>
  );
}

export function RenameGroupForm({ groupId, name }: { groupId: string; name: string }) {
  const [state, formAction, pending] = useActionState(renameGroup.bind(null, groupId), initialState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <label className="text-xs font-bold text-ink-soft">Nombre</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="name" defaultValue={name} className="xp-input flex-1" maxLength={60} required />
        <button type="submit" disabled={pending} className="xp-btn-secondary h-fit">
          Guardar
        </button>
      </div>
      <StateMessage state={state} />
    </form>
  );
}

type Person = { id: string; name: string; email: string };

/**
 * Lista de personas con casillas, para agregarlas al grupo o mandarles la
 * invitación por correo (según `mode`).
 */
export function PeoplePickerForm({
  groupId,
  people,
  mode,
}: {
  groupId: string;
  people: Person[];
  mode: "add" | "invite";
}) {
  const action = (mode === "add" ? addGroupMembers : inviteToGroup).bind(null, groupId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [filter, setFilter] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  if (people.length === 0) {
    return <p className="text-sm text-ink-soft">Todas las personas activas ya están en este grupo. 🎉</p>;
  }

  const term = filter.trim().toLowerCase();
  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      {people.length > 8 ? (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="xp-input text-sm"
          placeholder="Buscar por nombre o correo…"
        />
      ) : null}
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-panel-edge bg-panel p-2">
        {people.map((person) => (
          <li
            key={person.id}
            hidden={Boolean(term) && !`${person.name} ${person.email}`.toLowerCase().includes(term)}
          >
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--bubble-1)]">
              <input type="checkbox" name="userIds" value={person.id} />
              <span className="font-bold text-ink">{person.name}</span>
              <span className="truncate text-xs text-ink-faint">{person.email}</span>
            </label>
          </li>
        ))}
      </ul>
      <button type="submit" disabled={pending} className={mode === "add" ? "xp-btn-secondary self-start" : "xp-btn self-start"}>
        {pending ? "…" : mode === "add" ? "Agregar al grupo" : "Mandar invitación ✉️"}
      </button>
      <StateMessage state={state} />
    </form>
  );
}

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="xp-btn-secondary shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Sin permiso de portapapeles: el enlace sigue a la vista para copiarlo a mano.
        }
      }}
    >
      {copied ? "¡Copiado!" : "Copiar"}
    </button>
  );
}
