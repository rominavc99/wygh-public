import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNewsletterForDate, personalizeGreeting } from "@/lib/newsletter";
import { todayLocalDate, formatLocalDate } from "@/lib/date";
import { syncHeroPhotos } from "@/lib/hero-photos";
import { PreviewFrame } from "./preview-frame";
import { SendControls } from "./send-controls";
import { PhotoPhraseControls } from "./photo-phrase-controls";

export default async function BoletinPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || todayLocalDate();

  const [session, content, recipientCount, existingSend, photos, dailyPick, settings] = await Promise.all([
    auth(),
    getNewsletterForDate(date),
    prisma.user.count({ where: { active: true } }),
    prisma.newsletterSend.findUnique({ where: { date } }),
    syncHeroPhotos(),
    prisma.dailyPick.findUnique({ where: { date } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
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
          <h2 className="text-xl font-bold text-ink">💌 Boletín</h2>
          <p className="text-sm capitalize text-ink-soft">{formatLocalDate(date)}</p>
        </div>
        <form className="flex items-end gap-2">
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

      <SendControls date={date} alreadySent={Boolean(existingSend)} />

      {!existingSend ? (
        <PhotoPhraseControls
          date={date}
          photos={photos}
          currentPhotoId={dailyPick?.heroPhotoId ?? null}
          photoManual={dailyPick?.heroPhotoManual ?? false}
          phraseLocked={Boolean(settings.selectedPhraseId)}
        />
      ) : null}

      <PreviewFrame html={previewHtml} />
    </div>
  );
}
