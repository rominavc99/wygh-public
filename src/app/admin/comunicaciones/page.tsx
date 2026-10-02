import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { CommunicationForm } from "./communication-form";
import { cancelScheduledCommunication } from "./actions";

const statusLabel: Record<string, string> = {
  scheduled: "🕒 Programado",
  sent: "🟢 Enviado",
  partial: "🟡 Parcial",
  failed: "🔴 Falló",
};

const statusChip: Record<string, string> = {
  scheduled: "chip-blue",
  sent: "chip-pink",
  partial: "chip-neutral",
  failed: "chip-neutral",
};

export default async function ComunicacionesPage() {
  const [users, communications] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.communication.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const userOptions = users.map((u) => ({ id: u.id, label: `${displayName(u)} (${u.email})` }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">📣 Comunicaciones</h2>
        <p className="text-sm text-ink-soft">
          Manda avisos o actualizaciones importantes por correo — a todos o a personas específicas,
          ahora mismo o programado para después.
        </p>
      </div>

      <CommunicationForm users={userOptions} />

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-bold text-ink">Historial</h3>
        <ul className="flex flex-col gap-2">
          {communications.map((c) => {
            const recipientIds: string[] = c.audience === "selected" ? JSON.parse(c.recipientIds || "[]") : [];
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-panel-edge bg-panel-2 p-4"
              >
                <Link href={`/admin/comunicaciones/${c.id}`} className="min-w-50 flex-1">
                  <p className="font-bold text-ink hover:text-accent-pink-2 hover:underline">{c.subject}</p>
                  <p className="text-sm text-ink-soft">
                    {c.audience === "all" ? "Todos los usuarios activos" : `${recipientIds.length} persona(s) seleccionada(s)`}
                    {" · "}
                    {c.status === "scheduled"
                      ? `Programado para ${new Date(c.scheduledAt).toLocaleString("es-ES")}`
                      : `${c.sentAt ? new Date(c.sentAt).toLocaleString("es-ES") : ""} · ${c.recipientCount} destinatario${c.recipientCount === 1 ? "" : "s"}`}
                  </p>
                  {c.error ? <p className="mt-1 text-xs text-danger">{c.error}</p> : null}
                </Link>
                <div className="flex items-center gap-2">
                  <span className={`chip ${statusChip[c.status] ?? "chip-neutral"}`}>
                    {statusLabel[c.status] ?? c.status}
                  </span>
                  {c.status === "scheduled" ? (
                    <form action={cancelScheduledCommunication}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="xp-btn-danger">
                        Cancelar
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
          {communications.length === 0 ? (
            <p className="text-sm text-ink-soft">Todavía no se ha mandado ninguna comunicación.</p>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
