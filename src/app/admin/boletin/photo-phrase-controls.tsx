"use client";

import { useState, useTransition } from "react";
import { rerollPhotoAction, rerollPhraseAction, setManualPhotoAction } from "./actions";

type Photo = { id: string; filename: string; description: string | null };

export function PhotoPhraseControls({
  date,
  photos,
  currentPhotoId,
  photoManual,
  phraseLocked,
}: {
  date: string;
  photos: Photo[];
  currentPhotoId: string | null;
  photoManual: boolean;
  phraseLocked: boolean;
}) {
  const [, startTransition] = useTransition();
  const [photoPending, setPhotoPending] = useState(false);
  const [phrasePending, setPhrasePending] = useState(false);

  function rerollPhoto() {
    setPhotoPending(true);
    startTransition(async () => {
      await rerollPhotoAction(date);
      setPhotoPending(false);
    });
  }

  function rerollPhrase() {
    setPhrasePending(true);
    startTransition(async () => {
      await rerollPhraseAction(date);
      setPhrasePending(false);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-panel-edge bg-panel-2 p-4">
      <div>
        <h3 className="text-base font-bold text-ink">🎲 Foto y frase de portada</h3>
        <p className="text-xs text-ink-faint">Solo tiene efecto mientras el boletín de este día no se haya enviado.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-ink-soft">
          Foto {photoManual ? "(elegida a mano)" : "(automática)"}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <form action={setManualPhotoAction} className="flex items-center gap-2">
            <input type="hidden" name="date" value={date} />
            <select name="heroPhotoId" defaultValue={currentPhotoId ?? ""} className="xp-input">
              <option value="">Automática</option>
              {photos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.filename.replace("IMG/", "")}
                  {p.description ? ` — ${p.description}` : ""}
                </option>
              ))}
            </select>
            <button type="submit" className="xp-btn-secondary">
              Usar esta
            </button>
          </form>
          <button type="button" disabled={photoPending} onClick={rerollPhoto} className="xp-btn-secondary">
            {photoPending ? "Re-rolando…" : "🔀 Re-rolar foto"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-ink-soft">Frase</label>
        {phraseLocked ? (
          <p className="text-xs text-ink-faint">
            Hay una frase fija en Ajustes — quítala ahí para poder re-rolar.
          </p>
        ) : (
          <button type="button" disabled={phrasePending} onClick={rerollPhrase} className="xp-btn-secondary w-fit">
            {phrasePending ? "Re-rolando…" : "🔀 Re-rolar frase"}
          </button>
        )}
      </div>
    </div>
  );
}
