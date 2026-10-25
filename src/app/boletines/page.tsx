import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { resolveNewsletterHero, getSentHero, capitalize, missionsForNewsletter, type NewsletterHero } from "@/lib/newsletter";
import { parseMomentsSnapshot, topMoments } from "@/lib/birthday-newsletter";
import { displayName } from "@/lib/display-name";
import { addDaysLocal, todayLocalDate, formatLocalDate } from "@/lib/date";
import { ResponseCard, toCommentSummaries } from "./response-card";
import { ReactionBar } from "./reaction-bar";
import { CommentThread } from "./comment-thread";
import { summarizeReactions } from "@/lib/reactions";
import { ZoomableImage } from "./photo-lightbox";

export default async function BoletinesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; cumple?: string; grupo?: string; archivo?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await markSeen(session.user.id);

  const params = await searchParams;

  // Cada quien ve el archivo de sus grupos (también de los que están en
  // pausa); un admin, el de todos. Los grupos están aislados: un boletín
  // solo muestra las respuestas que se mandaron a ese grupo.
  const isAdmin = session.user.role === "ADMIN";
  const groups = await prisma.group.findMany({
    where: isAdmin ? {} : { members: { some: { userId: session.user.id } } },
    orderBy: { name: "asc" },
  });
  const group = groups.find((g) => g.id === params.grupo) ?? groups[0] ?? null;
  if (!group) {
    return (
      <BoletinesShell entries={[]} date="" cumple={null} groups={[]} groupId={null} legacy={false} hasLegacy={false}>
        {null}
      </BoletinesShell>
    );
  }

  // El primer resumen del día marca el corte: lo de antes es el formato
  // anterior ("¿Qué harás al llegar?") y va en su propia pestaña.
  const firstDay = await prisma.response.findFirst({ where: { format: "DAY" }, orderBy: { date: "asc" }, select: { date: true } });
  const isLegacyDate = (d: string) => !firstDay || d < firstDay.date;

  // Los boletines archivados no deben verse acá — ni en el selector ni
  // entrando directo con su fecha por la URL.
  const [allSends, birthdayEditions, extraordinaryGrantDays] = await Promise.all([
    prisma.newsletterSend.findMany({
      where: { groupId: group.id },
      select: { date: true, archived: true },
      orderBy: { date: "desc" },
    }),
    prisma.birthdayNewsletter.findMany({
      where: { sentAt: { not: null }, groupId: group.id },
      select: { userId: true, date: true, user: { select: { name: true, username: true } } },
      orderBy: { date: "desc" },
    }),
    // Días con respuestas extraordinarias (ver src/lib/extraordinary.ts):
    // si ese día no salió boletín (justo cuando la app falla), igual se
    // listan para que se vean las respuestas que llegaron después.
    prisma.extraordinaryGrant.findMany({
      where: { usedAt: { not: null } },
      select: { date: true },
      distinct: ["date"],
    }),
  ]);
  // De esos días, solo los que tienen alguna respuesta en este grupo.
  const extraordinaryDays = extraordinaryGrantDays.length
    ? await prisma.response.findMany({
        where: { date: { in: extraordinaryGrantDays.map((d) => d.date) }, groups: { some: { groupId: group.id } } },
        select: { date: true },
        distinct: ["date"],
      })
    : [];
  const sendDates = new Set(allSends.map((s) => s.date));
  const sentDates = [
    ...allSends.filter((s) => !s.archived),
    ...extraordinaryDays.filter((d) => !sendDates.has(d.date)),
  ];
  const archivedDates = new Set(allSends.filter((s) => s.archived).map((s) => s.date));

  // Diarios y de cumpleaños en una sola lista, del más reciente al más
  // viejo. El mismo día, el diario (sale en la tarde) va antes que el de
  // cumpleaños (sale en la mañana).
  const allEntries = [
    ...sentDates.map((s) => ({ date: s.date, cumple: null as string | null, celebrant: null as string | null })),
    ...birthdayEditions.map((e) => ({ date: e.date, cumple: e.userId, celebrant: displayName(e.user) })),
  ].sort((a, b) => b.date.localeCompare(a.date) || Number(Boolean(a.cumple)) - Number(Boolean(b.cumple)));
  const hasLegacy = allEntries.some((e) => isLegacyDate(e.date));
  // La pestaña elegida (?archivo=) manda. Sin elegir, y sin ningún boletín
  // de resumen todavía, se abre directo el archivo anterior.
  const legacy =
    params.archivo === "anterior" ||
    (params.archivo !== "resumenes" &&
      (params.date ? isLegacyDate(params.date) : !allEntries.some((e) => !isLegacyDate(e.date))));
  const entries = allEntries.filter((e) => isLegacyDate(e.date) === legacy);

  const selected = params.date || params.cumple ? null : entries[0] ?? null;
  const date = params.date || selected?.date || todayLocalDate();
  const cumple = params.cumple || selected?.cumple || null;
  const isArchived = !cumple && archivedDates.has(date);

  const shell = { entries, date, groups: groups.map((g) => ({ id: g.id, name: g.name })), groupId: group.id, legacy, hasLegacy };

  if (cumple) {
    return (
      <BoletinesShell {...shell} cumple={cumple}>
        <BirthdayEditionView userId={cumple} date={date} groupId={group.id} currentUserId={session.user.id} />
      </BoletinesShell>
    );
  }

  const mentionable = await mentionableUsers(group.id);
  const [responses, send, missions] = isArchived
    ? [[], null, []]
    : await Promise.all([
        prisma.response.findMany({
          where: { date, groups: { some: { groupId: group.id } } },
          include: {
            user: true,
            reactions: { where: { groupId: group.id }, include: { user: true } },
            comments: {
              where: { groupId: group.id, missionId: null },
              include: { user: true, reactions: { include: { user: true } }, mentions: { include: { user: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { user: { name: "asc" } },
        }),
        prisma.newsletterSend.findUnique({
          where: { groupId_date: { groupId: group.id, date } },
          select: { heroJson: true, contentHtml: true, contentText: true },
        }),
        missionsForNewsletter(group.id, date),
      ]);

  // Reacciones y comentarios de las misiones cumplidas, en este grupo.
  const missionInteractions = missions.length
    ? await prisma.missionAssignment.findMany({
        where: { id: { in: missions.map((m) => m.id) } },
        select: {
          id: true,
          reactions: { where: { groupId: group.id }, include: { user: true } },
          comments: {
            where: { groupId: group.id },
            include: { user: true, reactions: { include: { user: true } }, mentions: { include: { user: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      })
    : [];

  // La portada (título/párrafo/foto/frase) de un día ya enviado sale del
  // snapshot guardado en el envío, igual que el correo real — si se
  // resolviera en vivo con los ajustes actuales del grupo, preparar la portada del
  // día siguiente cambiaría la de todos los boletines anteriores. Solo se
  // resuelve en vivo para un día sin enviar (o un envío tan viejo que no
  // tiene contenido congelado). Las respuestas de cada quien sí son
  // estables una vez enviado el boletín (no se pueden editar después, ver
  // Settings.lockResponsesAfterSend).
  const sentHero = send ? getSentHero(send) : null;
  const hero = sentHero ?? (isArchived ? null : await resolveNewsletterHero(date, group));

  return (
    <BoletinesShell {...shell} cumple={null}>
      {isArchived ? (
        <p className="p-6 text-center text-sm text-ink-soft">Este boletín fue archivado por el admin. 📦</p>
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <EditionNav entries={entries} date={date} groupId={group.id} legacy={legacy} />

          {/* Atajos para no tener que bajar todo el boletín: se quedan a la vista al hacer scroll. */}
          {missions.length ? (
            <nav
              aria-label="Ir a una sección del boletín"
              className="sticky top-2 z-20 grid grid-cols-2 gap-2 rounded-2xl border-[2.5px] border-[var(--nb-line)] bg-panel p-1.5 shadow-[3px_3px_0_0_var(--nb-line)]"
            >
              <a href="#respuestas" className="chip chip-blue min-h-10 justify-center no-underline">
                Respuestas · {responses.length}
              </a>
              <a href="#misiones" className="chip min-h-10 justify-center bg-accent-pink-2 text-white no-underline">
                Misiones · {missions.length}
              </a>
            </nav>
          ) : null}

          {hero?.enabled && hero.title.trim() ? <HeroCard hero={hero} /> : null}

          {missions.length ? <MissionIndex missions={missions} /> : null}

          <p id="respuestas" className="scroll-mt-20 text-xs font-bold uppercase tracking-wide text-accent-pink-2">
            {responses.length} {legacy ? (responses.length === 1 ? "respuesta" : "respuestas") : responses.length === 1 ? "resumen" : "resúmenes"}
          </p>

          {responses.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {responses.map((r) => (
                <ResponseCard
                  key={r.id}
                  response={r}
                  groupId={group.id}
                  currentUserId={session.user.id}
                  mentionable={mentionable}
                  compact={responses.length > 3}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">{legacy ? "Nadie respondió ese día. 🦆" : "Nadie mandó su resumen ese día. 🦆"}</p>
          )}

          {missions.length ? (
            <MissionList
              missions={missions}
              interactions={missionInteractions}
              groupId={group.id}
              currentUserId={session.user.id}
              mentionable={mentionable}
            />
          ) : null}
        </div>
      )}
    </BoletinesShell>
  );
}

type Entry = { date: string; cumple: string | null; celebrant: string | null };
type MissionRow = Awaited<ReturnType<typeof missionsForNewsletter>>[number];

function editionHref(e: Entry, groupId: string): string {
  return e.cumple ? `/boletines?date=${e.date}&cumple=${e.cumple}&grupo=${groupId}` : `/boletines?date=${e.date}&grupo=${groupId}`;
}

/** Título del boletín diario con flechas al anterior y al siguiente. */
function EditionNav({ entries, date, groupId, legacy }: { entries: Entry[]; date: string; groupId: string; legacy: boolean }) {
  const daily = entries.filter((e) => !e.cumple);
  const index = daily.findIndex((e) => e.date === date);
  const newer = index > 0 ? daily[index - 1] : null;
  const older = index >= 0 && index < daily.length - 1 ? daily[index + 1] : null;
  const arrow = (e: Entry | null, label: string, glyph: string) =>
    e ? (
      <Link href={editionHref(e, groupId)} aria-label={label} className="chip chip-blue min-h-10 min-w-10 justify-center no-underline">
        {glyph}
      </Link>
    ) : (
      <span aria-hidden="true" className="min-w-10" />
    );
  return (
    <div className="flex items-center gap-2">
      {arrow(older, "Boletín anterior", "‹")}
      <div className="flex-1 text-center">
        {legacy ? (
          <h2 className="font-display text-lg font-bold capitalize text-ink">{formatLocalDate(date)}</h2>
        ) : (
          <>
            <p className="text-xs font-bold text-ink-faint">Boletín del {formatLocalDate(date)}</p>
            <h2 className="font-display text-lg font-bold text-ink">Resumen del {formatLocalDate(addDaysLocal(date, -1))}</h2>
          </>
        )}
      </div>
      {arrow(newer, "Boletín siguiente", "›")}
    </div>
  );
}

function missionLine(m: MissionRow): string {
  return m.mission.text.replaceAll("{usuario}", displayName(m.target));
}

/** Índice compacto de las misiones cumplidas, arriba de las respuestas. */
function MissionIndex({ missions }: { missions: MissionRow[] }) {
  return (
    <section className="win" aria-labelledby="misiones-rapidas">
      <div className="win-titlebar" style={{ backgroundImage: "linear-gradient(180deg, #ff8fc2 0%, var(--accent-pink-2) 70%)" }}>
        <span className="win-icon">🎯</span>
        <h3 id="misiones-rapidas" className="win-title">
          Misiones cumplidas
        </h3>
        <a href="#misiones" className="text-xs font-bold text-white underline">
          Ver detalle
        </a>
      </div>
      <ul>
        {missions.map((m, i) => (
          <li key={m.id} className={i ? "border-t-2 border-panel-edge" : ""}>
            <a href={`#mision-${m.id}`} className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm text-ink no-underline hover:bg-panel-2">
              <span className="min-w-0 flex-1">
                <strong>
                  {displayName(m.user)} → {displayName(m.target)}
                </strong>
                <span className="block truncate text-ink-soft">{missionLine(m)}</span>
              </span>
              {m.photoFilename ? <span className="chip chip-neutral text-[11px]">foto</span> : null}
              <span aria-hidden="true" className="font-bold text-chrome-4">
                ›
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

type MissionInteractions = {
  id: string;
  reactions: Parameters<typeof summarizeReactions>[0];
  comments: Parameters<typeof toCommentSummaries>[0];
};

/** Detalle de las misiones cumplidas, al final del boletín, con sus reacciones y comentarios. */
function MissionList({
  missions,
  interactions,
  groupId,
  currentUserId,
  mentionable,
}: {
  missions: MissionRow[];
  interactions: MissionInteractions[];
  groupId: string;
  currentUserId: string;
  mentionable: { id: string; name: string }[];
}) {
  return (
    <section id="misiones" className="flex scroll-mt-20 flex-col gap-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-accent-pink-2" style={{ fontFamily: "var(--font-varela), sans-serif" }}>🎯 Misiones cumplidas · {missions.length}</h3>
      {missions.map((m) => (
        <article id={`mision-${m.id}`} key={m.id} className="mission-card scroll-mt-20 flex flex-col gap-2 bg-white">
          <p className="text-sm font-bold text-ink-soft">
            <span className="font-display text-accent-pink-2">{displayName(m.user)}</span> para{" "}
            <span className="font-display text-accent-pink-2">{displayName(m.target)}</span>
          </p>
          <p className="text-sm font-bold text-ink">{missionLine(m)}</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{m.resolutionText}</p>
          {m.photoFilename ? (
            <ZoomableImage
              src={`/${m.photoFilename}`}
              alt=""
              caption={missionLine(m)}
              className="h-32 w-32 rounded-lg border border-panel-edge object-cover"
            />
          ) : null}
          <ReactionBar
            target={{ type: "mission", id: m.id, groupId }}
            reactions={summarizeReactions(interactions.find((i) => i.id === m.id)?.reactions ?? [], currentUserId)}
          />
          {m.responseId ? (
            <CommentThread
              responseId={m.responseId}
              groupId={groupId}
              missionId={m.id}
              comments={toCommentSummaries(interactions.find((i) => i.id === m.id)?.comments ?? [], currentUserId)}
              currentUserId={currentUserId}
              mentionable={mentionable}
            />
          ) : null}
        </article>
      ))}
    </section>
  );
}

function BoletinesShell({
  entries,
  date,
  cumple,
  groups,
  groupId,
  legacy,
  hasLegacy,
  children,
}: {
  entries: Entry[];
  date: string;
  cumple: string | null;
  groups: { id: string; name: string }[];
  groupId: string | null;
  /** Se está viendo el archivo del formato anterior. */
  legacy: boolean;
  hasLegacy: boolean;
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
        </div>

        {groups.length > 1 ? (
          <nav className="mb-4 flex flex-wrap gap-2 px-1" aria-label="Grupos">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/boletines?grupo=${g.id}`}
                aria-current={g.id === groupId ? "page" : undefined}
                className={`chip ${g.id === groupId ? "chip-pink" : "chip-neutral"}`}
              >
                🫂 {g.name}
              </Link>
            ))}
          </nav>
        ) : null}

        {hasLegacy && groupId ? (
          <nav className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border-[2.5px] border-[var(--nb-line)] bg-white shadow-[3px_3px_0_0_var(--nb-line)]" aria-label="Tipo de boletín">
            <Link
              href={`/boletines?grupo=${groupId}&archivo=resumenes`}
              aria-current={!legacy ? "page" : undefined}
              className={`min-h-11 px-2 py-2.5 text-center text-sm font-bold no-underline ${!legacy ? "bg-chrome-3 text-white" : "text-ink-soft"}`}
            >
              Resúmenes del día
            </Link>
            <Link
              href={`/boletines?grupo=${groupId}&archivo=anterior`}
              aria-current={legacy ? "page" : undefined}
              className={`min-h-11 border-l-[2.5px] border-[var(--nb-line)] px-2 py-2.5 text-center text-sm font-bold no-underline ${legacy ? "bg-chrome-3 text-white" : "text-ink-soft"}`}
            >
              Al llegar a casa (anterior)
            </Link>
          </nav>
        ) : null}

        {entries.length === 0 ? (
          <div className="win">
            <div className="win-body">
              <p className="text-sm text-ink-soft">
                {groupId && !legacy && hasLegacy
                  ? "Todavía no sale el primer boletín de Resumen del día: llega a la hora de envío del grupo (12:00), con los resúmenes del día anterior. Mientras, puedes ver el archivo en la pestaña \"Al llegar a casa (anterior)\". 🦆"
                  : groupId
                  ? "Todavía no se ha enviado ningún boletín en este grupo. 🦆"
                  : "Todavía no estás en ningún grupo, así que no hay boletines que mostrar. 🦆"}
              </p>
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
                  {groupId ? <input type="hidden" name="grupo" value={groupId} /> : null}
                  {legacy ? <input type="hidden" name="archivo" value="anterior" /> : null}
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
                    const href = groupId ? editionHref(e, groupId) : `/boletines?date=${e.date}`;
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
async function BirthdayEditionView({
  userId,
  date,
  groupId,
  currentUserId,
}: {
  userId: string;
  date: string;
  groupId: string;
  currentUserId: string;
}) {
  const edition = await prisma.birthdayNewsletter.findUnique({
    where: { userId_groupId_date: { userId, groupId, date } },
    include: { user: true },
  });
  if (!edition?.sentAt) {
    return <p className="p-6 text-center text-sm text-ink-soft">No encontramos ese boletín de cumpleaños. 🦆</p>;
  }

  const hero = getSentHero(edition);
  const snapshot = parseMomentsSnapshot(edition.momentsJson);
  const responseIds = snapshot?.responseIds ?? (await topMoments(userId, groupId, date)).map((m) => m.responseId);
  // Solo los momentos que se mandaron al grupo que se está viendo, con sus
  // reacciones y comentarios de ese grupo.
  const found = await prisma.response.findMany({
    where: { id: { in: responseIds }, groups: { some: { groupId } } },
    include: {
      user: true,
      reactions: { where: { groupId }, include: { user: true } },
      comments: {
        where: { groupId, missionId: null },
        include: { user: true, reactions: { include: { user: true } }, mentions: { include: { user: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const moments = responseIds.flatMap((id) => found.filter((r) => r.id === id));
  const mentionable = await mentionableUsers(groupId);
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
                <ResponseCard response={r} groupId={groupId} currentUserId={currentUserId} mentionable={mentionable} />
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

/** Personas que se pueden etiquetar en los comentarios (las activas). */
/** Personas que se pueden etiquetar con @: las activas del grupo (o todas, sin grupo). */
async function mentionableUsers(groupId?: string): Promise<{ id: string; name: string }[]> {
  const users = await prisma.user.findMany({
    where: { active: true, ...(groupId ? { groupMemberships: { some: { groupId } } } : {}) },
    select: { id: true, name: true, username: true },
  });
  return users.map((u) => ({ id: u.id, name: displayName(u) })).sort((a, b) => a.name.localeCompare(b.name));
}
