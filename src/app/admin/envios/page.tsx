import { prisma } from "@/lib/prisma";
import { toggleArchived } from "./actions";

const statusLabel: Record<string, string> = {
  sent: "🟢 Enviado",
  partial: "🟡 Parcial",
  failed: "🔴 Falló",
  already_sent: "🟢 Ya enviado",
};

const statusChip: Record<string, string> = {
  sent: "chip-pink",
  partial: "chip-neutral",
  failed: "chip-neutral",
  already_sent: "chip-neutral",
};

export default async function EnviosPage() {
  const sends = await prisma.newsletterSend.findMany({ orderBy: { date: "desc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">📮 Envíos</h2>
        <p className="text-sm text-ink-soft">
          Historial de boletines enviados. Los archivados dejan de verse en{" "}
          <span className="font-bold">/boletines</span> para miembros, pero siguen aquí.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {sends.map((send) => (
          <li
            key={send.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-panel-edge bg-panel-2 p-4"
          >
            <div>
              <p className="font-bold text-ink">
                {send.date} {send.archived ? <span className="chip chip-neutral ml-1">📦 Archivado</span> : null}
              </p>
              <p className="text-sm text-ink-soft">
                {send.recipientCount} destinatario{send.recipientCount === 1 ? "" : "s"} ·{" "}
                {send.responseCount} respuesta{send.responseCount === 1 ? "" : "s"} ·{" "}
                {new Date(send.sentAt).toLocaleString("es-ES")}
              </p>
              {send.error ? <p className="mt-1 text-xs text-danger">{send.error}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <span className={`chip ${statusChip[send.status] ?? "chip-neutral"}`}>
                {statusLabel[send.status] ?? send.status}
              </span>
              <form action={toggleArchived}>
                <input type="hidden" name="date" value={send.date} />
                <input type="hidden" name="nextArchived" value={(!send.archived).toString()} />
                <button type="submit" className="xp-btn-secondary">
                  {send.archived ? "Desarchivar" : "Archivar"}
                </button>
              </form>
            </div>
          </li>
        ))}
        {sends.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no se ha enviado ningún boletín.</p>
        ) : null}
      </ul>
    </div>
  );
}
