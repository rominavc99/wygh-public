"use client";

import { useActionState } from "react";
import { updateHeroPhoto, type PhotoFormState } from "./actions";

type Photo = {
  id: string;
  filename: string;
  description: string | null;
  date: string | null;
  authorName: string | null;
};

const initialState: PhotoFormState = { status: "idle" };

export function PhotoCard({ photo }: { photo: Photo }) {
  const [state, formAction, pending] = useActionState(updateHeroPhoto, initialState);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-panel-edge bg-panel-2 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/${photo.filename}`}
        alt=""
        className="h-36 w-full rounded-lg border border-panel-edge object-cover"
      />
      <p className="truncate text-xs text-ink-faint" title={photo.filename}>
        {photo.filename.replace("IMG/", "")}
      </p>
      {photo.authorName ? (
        <p className="text-xs text-ink-faint">Enviada por {photo.authorName}</p>
      ) : null}
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={photo.id} />
        <input
          name="description"
          defaultValue={photo.description ?? ""}
          placeholder="Descripción (opcional)"
          className="xp-input text-sm"
        />
        <input
          name="date"
          type="date"
          defaultValue={photo.date ?? ""}
          className="xp-input text-sm"
        />
        <button type="submit" disabled={pending} className="xp-btn-secondary w-full text-center">
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {state.status === "success" ? (
          <p className="text-center text-xs font-bold text-accent-pink-2">💾 Guardado</p>
        ) : null}
        {state.status === "error" ? (
          <p className="text-center text-xs text-danger">{state.message}</p>
        ) : null}
      </form>
    </li>
  );
}
