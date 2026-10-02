import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { requireAdmin } from "@/lib/auth-guards";
import { toLocalDatetimeInputValue } from "@/lib/date";
import { CommunicationEditForm } from "./communication-edit-form";
import { cancelScheduledCommunication } from "../actions";

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

export default async function ComunicacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [communication, activeUsers] = await Promise.all([
    prisma.communication.findUnique({ where: { id }, include: { createdBy: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!communication) notFound();

  const recipientIds: string[] =
    communication.audience === "selected" ? JSON.parse(communication.recipientIds || "[]") : [];
  // Puede incluir gente ya desactivada desde que se creó/programó — se
  // busca aparte para no perder ese nombre en el resumen "Para:".
  const recipientUsers =
    recipientIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: recipientIds } } })
      : [];
  const isEditable = communication.status === "scheduled";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin/comunicaciones" className="text-sm font-bold text-chrome-4 hover:underline">
            ← Comunicaciones
          </Link>
          <h2 className="mt-1 text-xl font-bold text-ink">{communication.subject}</h2>
        </div>
        <span className={`chip ${statusChip[communication.status] ?? "chip-neutral"}`}>
          {statusLabel[communication.status] ?? communication.status}
        </span>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-panel-edge bg-panel-2 p-4 text-sm text-ink-soft">
        <p>
          <strong className="text-ink">De:</strong> {displayName(communication.createdBy)}
        </p>
        <p>
          <strong className="text-ink">Para:</strong>{" "}
          {communication.audience === "all"
            ? "Todos los usuarios activos"
            : recipientUsers.map((u) => displayName(u)).join(", ") || "—"}
        </p>
        <p>
          <strong className="text-ink">
            {communication.status === "scheduled" ? "Programado para:" : "Enviado:"}
          </strong>{" "}
          {communication.status === "scheduled"
            ? new Date(communication.scheduledAt).toLocaleString("es-ES")
            : communication.sentAt
              ? new Date(communication.sentAt).toLocaleString("es-ES")
              : "—"}
          {communication.status !== "scheduled"
            ? ` · ${communication.recipientCount} destinatario${communication.recipientCount === 1 ? "" : "s"}`
            : ""}
        </p>
        {communication.error ? <p className="text-danger">{communication.error}</p> : null}
      </div>

      {isEditable ? (
        <>
          <div className="flex justify-end">
            <form action={cancelScheduledCommunication}>
              <input type="hidden" name="id" value={communication.id} />
              <button type="submit" className="xp-btn-danger">
                Cancelar comunicación
              </button>
            </form>
          </div>

          <CommunicationEditForm
            id={communication.id}
            users={activeUsers.map((u) => ({ id: u.id, label: `${displayName(u)} (${u.email})` }))}
            initial={{
              subject: communication.subject,
              bodyHtml: communication.bodyHtml,
              audience: communication.audience as "all" | "selected",
              recipientIds,
              scheduledAt: toLocalDatetimeInputValue(new Date(communication.scheduledAt)),
            }}
          />
        </>
      ) : (
        <div className="win">
          <div className="win-body">
            <div
              className="text-sm leading-relaxed text-ink"
              dangerouslySetInnerHTML={{ __html: communication.bodyHtml }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
