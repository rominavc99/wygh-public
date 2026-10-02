import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveNewsletterHero, getSentHero, capitalize, type NewsletterHero } from "@/lib/newsletter";
import { parseMomentsSnapshot, topMoments } from "@/lib/birthday-newsletter";
import { displayName } from "@/lib/display-name";
import { todayLocalDate, formatLocalDate } from "@/lib/date";
import { ResponseCard } from "./response-card";
import { ZoomableImage } from "./photo-lightbox";

export default async function BoletinesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; cumple?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;

  // Los boletines archivados no deben verse acá — ni en el selector ni
  // entrando directo con su fecha por la URL.
  const [allSends, birthdayEditions] = await Promise.all([
    prisma.newsletterSend.findMany({
      select: { date: true, archived: true },
      orderBy: { date: "desc" },
    }),
    prisma.birthdayNewsletter.findMany({
      where: { sentAt: { not: null } },
      select: { userId: true, date: true, user: { select: { name: true, username: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  const sentDates = allSends.filter((s) => !s.archived);
  const archivedDates = new Set(allSends.filter((s) => s.archived).map((s) => s.date));

  // Diarios y de cumpleaños en una sola lista, del más reciente al más
  // viejo. El mismo día, el diario (sale en la tarde) va antes que el de
  // cumpleaños (sale en la mañana).
  const entries = [
    ...sentDates.map((s) => ({ date: s.date, cumple: null as string | null, celebrant: null as string | null })),
    ...birthdayEditions.map((e) => ({ date: e.date, cumple: e.userId, celebrant: displayName(e.user) })),
  ].sort((a, b) => b.date.localeCompare(a.date) || Number(Boolean(a.cumple)) - Number(Boolean(b.cumple)));

  const selected = params.date || params.cumple ? null : entries[0] ?? null;
  const date = params.date || selected?.date || todayLocalDate();
  const cumple = params.cumple || selected?.cumple || null;
  const isArchived = !cumple && archivedDates.has(date);

  if (cumple) {
    return (
      <BoletinesShell entries={entries} date={date} cumple={cumple}>
        <BirthdayEditionView userId={cumple} date={date} currentUserId={session.user.id} />
      </BoletinesShell>
    );
  }

  const [responses, settings, send] = isArchived
    ? [[], null, null]
    : await Promise.all([
        prisma.response.findMany({
          where: { date },
          include: {
            user: true,
            reactions: { include: { user: true } },
            comments: {
              include: { user: true, reactions: { include: { user: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { user: { name: "asc" } },
        }),
        prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
        prisma.newsletterSend.findUnique({
          where: { date },
          select: { heroJson: true, contentHtml: true, contentText: true },
        }),
      ]);

  // La portada (título/párrafo/foto/frase) de un día ya enviado sale del
  // snapshot guardado en el envío, igual que el correo real — si se
  // resolviera en vivo con los Ajustes actuales, preparar la portada del
  // día siguiente cambiaría la de todos los boletines anteriores. Solo se
  // resuelve en vivo para un día sin enviar (o un envío tan viejo que no
  // tiene contenido congelado). Las respuestas de cada quien sí son
  // estables una vez enviado el boletín (no se pueden editar después, ver
  // Settings.lockResponsesAfterSend).
  const sentHero = send ? getSentHero(send) : null;
  const hero = sentHero ?? (settings ? await resolveNewsletterHero(date, settings) : null);

  return (
    <BoletinesShell entries={entries} date={date} cumple={null}>
      {isArchived ? (
        <p className="p-6 text-center text-sm text-ink-soft">Este boletín fue archivado por el admin. 📦</p>
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">{formatLocalDate(date)}</p>
          </div>

          {hero?.enabled && hero.title.trim() ? <HeroCard hero={hero} /> : null}

          {responses.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {responses.map((r) => (
                <ResponseCard key={r.id} response={r} currentUserId={session.user.id} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Nadie respondió ese día. 🦆</p>
          )}
        </div>
      )}
    </BoletinesShell>
  );
}

type Entry = { date: string; cumple: string | null; celebrant: string | null };

function BoletinesShell({
  entries,
  date,
  cumple,
  children,
}: {
  entries: Entry[];
  date: string;
  cumple: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="mb-5 flex items-start justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              Archivo
            </p>
            <h1 className="text-2xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              📬 Boletines
            </h1>
          </div>
          <Link href="/" className="chip chip-blue">
            ← Volver al formulario
          </Link>
        </div>

        {entries.length === 0 ? (
          <div className="win">
            <div className="win-body">
              <p className="text-sm text-ink-soft">Todavía no se ha enviado ningún boletín. 🦆</p>
            </div>
          </div>
        ) : (
          <div className="win overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-stretch">
              <div className="flex-none border-b border-panel-edge bg-panel-2 md:w-64 md:border-b-0 md:border-r">
                <div className="flex items-center gap-2 border-b border-panel-edge px-4 py-3">
                  <span className="text-lg">📬</span>
                  <span className="font-display text-sm font-bold text-ink">Enviados</span>
                </div>

                <form className="flex items-end gap-2 border-b border-panel-edge p-3">
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-xs font-bold text-ink-soft">Ir a una fecha</label>
                    <input type="date" name="date" defaultValue={date} className="xp-input text-sm" />
                  </div>
                  <button type="submit" className="xp-btn-secondary shrink-0 px-3 text-xs">
                    Ver
                  </button>
                </form>

                <ul className="flex overflow-x-auto md:block md:max-h-[680px] md:overflow-x-visible md:overflow-y-auto">
                  {entries.map((e) => {
                    const active = e.date === date && e.cumple === cumple;
                    const href = e.cumple ? `/boletines?date=${e.date}&cumple=${e.cumple}` : `/boletines?date=${e.date}`;
                    return (
                      <li key={`${e.date}-${e.cumple ?? "diario"}`} className="flex-none md:flex-auto">
                        <Link
                          href={href}
                          className={`block whitespace-nowrap border-b border-panel-edge px-4 py-3 text-sm font-bold md:whitespace-normal ${
                            active ? "bg-panel text-accent-pink-2" : "text-ink-soft hover:bg-panel"
                          }`}
                        >
                          <span className="capitalize">{formatLocalDate(e.date)}</span>
                          {e.cumple ? (
                            <span className="chip chip-pink mt-1 flex w-fit items-center gap-1 text-[11px]">
                              🎂 Cumpleaños de {e.celebrant}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="min-w-0 flex-1 bg-panel-2 p-6">{children}</div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function HeroCard({ hero }: { hero: NewsletterHero }) {
  return (
    <div className="rounded-xl border border-panel-edge bg-panel p-4">
      {hero.imageUrl.trim() ? (
        <>
          <ZoomableImage
            src={hero.imageUrl}
            alt=""
            caption={hero.imageCaption?.description}
            className="mb-2 w-full rounded-lg border border-panel-edge object-cover"
          />
          {hero.imageCaption?.description || hero.imageCaption?.authorName ? (
            <p className="mb-3 text-xs italic text-ink-faint">
              📷{" "}
              {[hero.imageCaption?.description, hero.imageCaption?.authorName ? `Foto de ${hero.imageCaption.authorName}` : null]
                .filter(Boolean)
                .join(" — ")}
            </p>
          ) : null}
        </>
      ) : null}
      <h2 className="font-display text-xl font-bold text-ink">{hero.title}</h2>
      {hero.paragraph.trim() ? <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{hero.paragraph}</p> : null}
      {hero.dailyPhrase?.trim() ? (
        <div className="mt-3 rounded-lg border border-panel-edge bg-panel-2 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">💭 Frase del día</p>
          <p className="mt-1 font-display italic text-ink">&quot;{hero.dailyPhrase}&quot;</p>
          {hero.dailyPhraseAuthor ? <p className="mt-1 text-[11px] text-ink-faint">— {hero.dailyPhraseAuthor}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Boletín de cumpleaños ya enviado: portada y top 5 salen del snapshot del
 * envío (heroJson/momentsJson), pero cada momento se pinta con la tarjeta
 * interactiva de siempre, así que se puede seguir reaccionando y comentando.
 */
async function BirthdayEditionView({ userId, date, currentUserId }: { userId: string; date: string; currentUserId: string }) {
  const edition = await prisma.birthdayNewsletter.findUnique({
    where: { userId_date: { userId, date } },
    include: { user: true },
  });
  if (!edition?.sentAt) {
    return <p className="p-6 text-center text-sm text-ink-soft">No encontramos ese boletín de cumpleaños. 🦆</p>;
  }

  const hero = getSentHero(edition);
  const snapshot = parseMomentsSnapshot(edition.momentsJson);
  const responseIds = snapshot?.responseIds ?? (await topMoments(userId, date)).map((m) => m.responseId);
  const found = await prisma.response.findMany({
    where: { id: { in: responseIds } },
    include: {
      user: true,
      reactions: { include: { user: true } },
      comments: {
        include: { user: true, reactions: { include: { user: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const moments = responseIds.flatMap((id) => found.filter((r) => r.id === id));
  const celebrant = displayName(edition.user);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">{formatLocalDate(date)}</p>
        <span className="chip chip-pink text-xs">🎂 Edición de cumpleaños de {celebrant}</span>
      </div>

      {hero?.title.trim() ? <HeroCard hero={hero} /> : null}

      <h2 className="font-display text-lg font-bold text-ink">🏆 {snapshot?.title ?? "Top 5 momentos del año"}</h2>

      {moments.length > 0 ? (
        <ul className="flex flex-col gap-5">
          {moments.map((r, i) => (
            <li key={r.id} className="flex flex-col gap-1.5">
              <p className="text-xs font-bold text-accent-pink-2">
                #{i + 1} · 📅 {capitalize(formatLocalDate(r.date))}
              </p>
              <ul>
                <ResponseCard response={r} currentUserId={currentUserId} />
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">
          Ese año todavía no hubo respuestas con reacciones o comentarios… ¡pero igual te queremos! 💖
        </p>
      )}
    </div>
  );
}
