"use client";

import { useState, useTransition } from "react";
import { sendBirthdayNow, rerollBirthdayPhotoAction, setManualBirthdayPhotoAction } from "./actions";
import type { BirthdaySendResult } from "@/lib/send-birthday";

type Photo = { id: string; filename: string; description: string | null };

export function BirthdaySendControls({
  userId,
  date,
  alreadySent,
}: {
  userId: string;
  date: string;
  alreadySent: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BirthdaySendResult | null>(null);

  function trigger(force: boolean) {
    startTransition(async () => {
      setResult(await sendBirthdayNow(userId, date, force));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {!alreadySent ? (
          <button type="button" disabled={pending} onClick={() => trigger(false)} className="xp-btn">
            {pending ? "Enviando…" : "Enviar ahora →"}
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => trigger(true)} className="xp-btn-secondary">
            {pending ? "Reenviando…" : "🔁 Reenviar"}
          </button>
        )}
      </div>
      {result ? (
        <p className={`text-sm ${result.status === "failed" ? "text-danger" : "text-ink-soft"}`}>
          {resultMessage(result)}
        </p>
      ) : null}
    </div>
  );
}

function resultMessage(result: BirthdaySendResult): string {
  switch (result.status) {
    case "sent":
      return `Enviado a ${result.recipientCount} persona${result.recipientCount === 1 ? "" : "s"}.`;
    case "partial":
      return `Enviado con errores: ${result.error}`;
    case "failed":
      return `No se pudo enviar: ${result.error}`;
    case "already_sent":
      return "Ya se había enviado antes; usa Reenviar si quieres volver a mandarlo.";
  }
}

export function BirthdayPhotoControls({
  userId,
  date,
  photos,
  currentPhotoId,
  photoManual,
}: {
  userId: string;
  date: string;
  photos: Photo[];
  currentPhotoId: string | null;
  photoManual: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-panel-edge bg-panel-2 p-4">
        <h3 className="text-base font-bold text-ink">🖼️ Foto de portada</h3>
        <p className="text-xs text-ink-faint">
          Esta persona todavía no ha subido fotos, así que la portada sale sin imagen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-panel-edge bg-panel-2 p-4">
      <h3 className="text-base font-bold text-ink">🖼️ Foto de portada {photoManual ? "(elegida a mano)" : "(automática)"}</h3>
      <p className="text-xs text-ink-faint">
        Sale de las {photos.length} foto{photos.length === 1 ? "" : "s"} que ha subido esta persona. Solo tiene
        efecto mientras este boletín no se haya enviado.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <form action={setManualBirthdayPhotoAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="date" value={date} />
          <select name="heroPhotoId" defaultValue={currentPhotoId ?? ""} className="xp-input max-w-72">
            <option value="">Automática</option>
            {photos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.description || p.filename.replace(/^IMG\/(respuestas\/)?/, "")}
              </option>
            ))}
          </select>
          <button type="submit" className="xp-btn-secondary">
            Usar esta
          </button>
        </form>
        <button
          type="button"
          disabled={pending || photos.length < 2}
          onClick={() => startTransition(() => rerollBirthdayPhotoAction(userId, date))}
          className="xp-btn-secondary"
        >
          {pending ? "Re-rolando…" : "🔀 Re-rolar foto"}
        </button>
      </div>
    </div>
  );
}
