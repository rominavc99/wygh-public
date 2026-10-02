import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayLocalDate, formatLocalDate, nextBirthdayDate } from "@/lib/date";
import { displayName } from "@/lib/display-name";
import { personalizeGreeting } from "@/lib/newsletter";
import { getBirthdayNewsletterPreview, photosByUser } from "@/lib/birthday-newsletter";
import { PreviewFrame } from "../boletin/preview-frame";
import { BirthdaySettingsForm } from "./birthday-settings-form";
import { BirthdaySendControls, BirthdayPhotoControls } from "./birthday-controls";

function monthDayLabel(birthday: string): string {
  const [, m, d] = birthday.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86_400_000);
}

export default async function CumpleanosPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; date?: string }>;
}) {
  const params = await searchParams;
  const today = todayLocalDate();

  const [settings, users, sentEditions] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.birthdayNewsletter.findMany({
      where: { sentAt: { not: null } },
      include: { user: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const upcoming = users
    .filter((u) => u.birthday)
    .map((u) => {
      const next = nextBirthdayDate(u.birthday!, today);
      return { user: u, next, inDays: daysBetween(today, next) };
    })
    .sort((a, b) => a.next.localeCompare(b.next));
  const withoutBirthday = users.filter((u) => !u.birthday);

  const selectedUser = params.user ? users.find((u) => u.id === params.user) ?? null : null;
  const selectedDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : selectedUser?.birthday
        ? nextBirthdayDate(selectedUser.birthday, today)
        : today;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">🎂 Cumpleaños</h2>
        <p className="text-sm text-ink-soft">
          El día del cumpleaños de alguien sale, a las {settings.birthdaySendTime}, un boletín especial para
          felicitarle (además del diario de la tarde).
          {settings.birthdayEnabled ? "" : " ⚠️ El envío automático está desactivado."}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-base font-bold text-ink">📅 Próximos cumpleaños</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-soft">Nadie ha registrado su fecha de nacimiento todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map(({ user, next, inDays }) => (
              <li
                key={user.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-panel-edge p-3 ${
                  selectedUser?.id === user.id ? "bg-panel" : "bg-panel-2"
                }`}
              >
                <div>
                  <p className="font-bold text-ink">{displayName(user)}</p>
                  <p className="text-sm text-ink-soft">
                    {monthDayLabel(user.birthday!)} ·{" "}
                    {inDays === 0 ? "🎉 ¡Hoy!" : inDays === 1 ? "mañana" : `en ${inDays} días`}
                  </p>
                </div>
                <Link href={`/admin/cumpleanos?user=${user.id}&date=${next}`} className="xp-btn-secondary">
                  Ver boletín
                </Link>
              </li>
            ))}
          </ul>
        )}
        {withoutBirthday.length ? (
          <p className="text-xs text-ink-faint">
            Sin fecha registrada: {withoutBirthday.map((u) => displayName(u)).join(", ")}.
          </p>
        ) : null}
      </section>

      {selectedUser ? (
        <BirthdayEditionPreview
          userId={selectedUser.id}
          userName={displayName(selectedUser)}
          date={selectedDate}
        />
      ) : null}

      {sentEditions.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-bold text-ink">📮 Enviados</h3>
          <ul className="flex flex-col gap-1">
            {sentEditions.map((e) => (
              <li key={e.id} className="text-sm text-ink-soft">
                <Link href={`/admin/cumpleanos?user=${e.userId}&date=${e.date}`} className="font-bold text-ink hover:underline">
                  {e.date} — {displayName(e.user)}
                </Link>{" "}
                · {e.recipientCount} destinatarios · {e.status}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BirthdaySettingsForm settings={settings} />
    </div>
  );
}

async function BirthdayEditionPreview({ userId, userName, date }: { userId: string; userName: string; date: string }) {
  // La vista previa resuelve (y deja fija) la foto de portada, así que la
  // fila de la edición se lee después.
  const [session, preview] = await Promise.all([auth(), getBirthdayNewsletterPreview(userId, date)]);
  const [edition, photos, recipientCount] = await Promise.all([
    prisma.birthdayNewsletter.findUnique({ where: { userId_date: { userId, date } } }),
    photosByUser(userId),
    prisma.user.count({ where: { active: true } }),
  ]);

  const previewHtml = personalizeGreeting(preview, session?.user.name ?? "Tu Nombre", preview.greetingTemplate).html;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-panel-edge p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-ink">💌 Boletín de cumpleaños de {userName}</h3>
          <p className="text-sm capitalize text-ink-soft">{formatLocalDate(date)}</p>
        </div>
        <form className="flex items-end gap-2">
          <input type="hidden" name="user" value={userId} />
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
          {preview.momentCount} momento{preview.momentCount === 1 ? "" : "s"}
        </span>
        <span className="chip chip-blue">
          {preview.recipientCount ?? recipientCount} destinatario
          {(preview.recipientCount ?? recipientCount) === 1 ? "" : "s"}
        </span>
        {preview.sentAt ? (
          <span className="chip chip-neutral">Enviado el {new Date(preview.sentAt).toLocaleString("es-ES")}</span>
        ) : null}
        {preview.frozen ? (
          <span className="chip chip-neutral" title="Se muestra tal cual se envió">
            🧊 Congelado
          </span>
        ) : null}
      </div>
      {preview.error ? <p className="text-xs text-danger">{preview.error}</p> : null}

      <BirthdaySendControls userId={userId} date={date} alreadySent={preview.sent} />

      {!preview.sent ? (
        <BirthdayPhotoControls
          userId={userId}
          date={date}
          photos={photos}
          currentPhotoId={edition?.heroPhotoId ?? null}
          photoManual={edition?.heroPhotoManual ?? false}
        />
      ) : null}

      <PreviewFrame html={previewHtml} />
    </section>
  );
}
