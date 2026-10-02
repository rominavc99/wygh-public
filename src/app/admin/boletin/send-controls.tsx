"use client";

import { useState, useTransition } from "react";
import { sendNewsletterNow } from "./actions";
import type { SendResult } from "@/lib/send-newsletter";

export function SendControls({ date, alreadySent }: { date: string; alreadySent: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SendResult | null>(null);

  function trigger(force: boolean) {
    startTransition(async () => {
      const r = await sendNewsletterNow(date, force);
      setResult(r);
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
          <button
            type="button"
            disabled={pending}
            onClick={() => trigger(true)}
            className="xp-btn-secondary"
          >
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

function resultMessage(result: SendResult): string {
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
