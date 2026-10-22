import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNewsletterForDate, personalizeGreeting } from "@/lib/newsletter";
import { todayLocalDate, formatLocalDate } from "@/lib/date";
import { syncHeroPhotos, heroPhotosForGroup } from "@/lib/hero-photos";
import { PreviewFrame } from "./preview-frame";
import { SendControls } from "./send-controls";
import { PhotoPhraseControls } from "./photo-phrase-controls";

export default async function BoletinPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; grupo?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || todayLocalDate();

  const groups = await prisma.group.findMany({ orderBy: [{ suspended: "asc" }, { name: "asc" }] });
  const group = groups.find((g) => g.id === params.grupo) ?? groups[0];
  if (!group) {
    return <p className="text-sm text-ink-soft">Todavía no hay grupos. Crea uno en la pestaña Grupos.</p>;
  }

  const [session, content, recipientCount, existingSend, photos, dailyPick] = await Promise.all([
    auth(),
    getNewsletterForDate(group.id, date),
    prisma.user.count({ where: { active: true, groupMemberships: { some: { groupId: group.id } } } }),
    prisma.newsletterSend.findUnique({ where: { groupId_date: { groupId: group.id, date } } }),
    syncHeroPhotos().then((all) => heroPhotosForGroup(group.id, all)),
    prisma.dailyPick.findUnique({ where: { groupId_date: { groupId: group.id, date } } }),
  ]);

  const previewHtml = personalizeGreeting(
    content,
    session?.user.name ?? "Tu Nombre",
    content.greetingTemplate
  ).html;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">💌 Boletín — {group.name}</h2>
          <p className="text-sm capitalize text-ink-soft">{formatLocalDate(date)}</p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          {groups.length > 1 ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-ink-soft">Grupo</label>
              <select name="grupo" defaultValue={group.id} className="xp-select">
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.suspended ? " (en pausa)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-ink-soft">Fecha</label>
            <input type="date" name="date" defaultValue={date} className="xp-input" />
          </div>
          <button type="submit" className="xp-btn-secondary">
            Ver
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="chip chip-pink">
          {content.responseCount} respuesta{content.responseCount === 1 ? "" : "s"}
        </span>
        <span className="chip chip-blue">
          {recipientCount} destinatario{recipientCount === 1 ? "" : "s"}
        </span>
        <span className="chip chip-neutral">🕗 Sale a las {group.sendTime}</span>
        {group.suspended ? <span className="chip chip-neutral">⏸ Grupo en pausa</span> : null}
        {existingSend ? (
          <span className="chip chip-neutral">
            Enviado el {new Date(existingSend.sentAt).toLocaleString("es-ES")}
          </span>
        ) : null}
        {content.frozen ? (
          <span className="chip chip-neutral" title="Se muestra tal cual se envió, no reconstruido con los ajustes actuales">
            🧊 Congelado
          </span>
        ) : null}
      </div>

      <SendControls groupId={group.id} date={date} alreadySent={Boolean(existingSend)} />

      {!existingSend ? (
        <PhotoPhraseControls
          groupId={group.id}
          date={date}
          photos={photos}
          currentPhotoId={dailyPick?.heroPhotoId ?? null}
          photoManual={dailyPick?.heroPhotoManual ?? false}
          phraseLocked={Boolean(group.selectedPhraseId)}
        />
      ) : null}

      <PreviewFrame html={previewHtml} />
    </div>
  );
}
