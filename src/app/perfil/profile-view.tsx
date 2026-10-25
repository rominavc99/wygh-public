import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { avatarGradient } from "@/lib/avatar";
import { describedDate, formatLocalDate } from "@/lib/date";
import { lastVisits } from "@/lib/last-seen";
import { missionText } from "@/lib/missions";
import { capitalize } from "@/lib/newsletter";
import { profileStats, profileVisibility, type ProfileTab, type ProfileVisibility } from "@/lib/profile";
import type { Prisma } from "@/generated/prisma/client";

const PAGE = 30;

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function birthdayLabel(birthday: string): string {
  const [, m, d] = birthday.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

function sinceLabel(date: Date | undefined): string | null {
  if (!date) return null;
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 60) return "Visto hace un rato";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Visto hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Visto hace ${days} día${days === 1 ? "" : "s"}`;
}

/**
 * Cabecera, números e historial de un perfil. `basePath` es la ruta de la
 * página (para las pestañas); `actions` va debajo de los números.
 */
export async function ProfileView({
  ownerId,
  viewer,
  tab,
  limit,
  basePath,
  actions,
}: {
  ownerId: string;
  viewer: { id: string; role: string };
  tab: ProfileTab;
  limit: number;
  basePath: string;
  actions?: React.ReactNode;
}) {
  const visibility = await profileVisibility(ownerId, viewer);
  if (!visibility) return <p className="text-sm text-ink-soft">No compartes ningún grupo con esta persona. 🦆</p>;

  const [owner, stats, visits, latest] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ownerId } }),
    profileStats(ownerId, visibility.own),
    lastVisits([ownerId]),
    prisma.response.findFirst({ where: { ...visibility.own, format: "DAY", mood: { not: null } }, orderBy: { date: "desc" }, select: { mood: true } }),
  ]);
  const name = displayName(owner);
  const isMe = viewer.id === ownerId;
  const seen = isMe ? null : sinceLabel(visits.get(ownerId));
  const tabHref = (t: ProfileTab) => `${basePath}?tab=${t}`;

  return (
    <div className="flex flex-col gap-5">
      <section className="win">
        <div className="win-titlebar">
          <span className="win-icon">👤</span>
          <h1 className="win-title">{isMe ? "Mi perfil" : name}</h1>
          <div className="win-btns" aria-hidden="true">
            <div className="win-btn">_</div>
            <div className="win-btn">□</div>
            <div className="win-btn close">×</div>
          </div>
        </div>
        <div className="win-body flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="avatar !h-[72px] !w-[72px] !text-3xl" style={{ background: avatarGradient(name) }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-bold leading-tight text-ink">{name}</p>
              <p className="text-sm text-ink-soft">
                {[owner.username ? owner.name : null, seen].filter(Boolean).join(" · ")}
              </p>
              {latest?.mood ? (
                <p className="mt-1 text-sm text-ink">
                  <strong>Estado:</strong> {latest.mood}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 rounded-xl border-[2.5px] border-[var(--nb-line)] bg-white text-center">
            <Stat value={stats.streak} label="días de racha" />
            <Stat value={stats.responses} label="respuestas" border />
            <Stat value={stats.missionsDone} label="misiones cumplidas" />
          </div>
          {owner.birthday ? (
            <div className="flex flex-wrap gap-2">
              <span className="chip chip-pink">🎂 Cumple el {birthdayLabel(owner.birthday)}</span>
            </div>
          ) : null}
          {actions}
        </div>
      </section>

      <nav
        aria-label="Historial"
        className="grid grid-cols-3 overflow-hidden rounded-xl border-[2.5px] border-[var(--nb-line)] bg-white shadow-[3px_3px_0_0_var(--nb-line)]"
      >
        {(
          [
            ["resumenes", "Resúmenes"],
            ["casa", "Al llegar a casa"],
            ["misiones", "Misiones"],
          ] as const
        ).map(([t, label], i) => (
          <Link
            key={t}
            href={tabHref(t)}
            aria-current={tab === t ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center px-1 text-center text-sm font-bold no-underline ${
              i ? "border-l-[2.5px] border-[var(--nb-line)]" : ""
            } ${tab === t ? "bg-chrome-3 text-white" : "text-ink-soft"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "misiones" ? (
        <MissionHistory ownerId={ownerId} ownerName={name} visibility={visibility} isMe={isMe} limit={limit} />
      ) : (
        <ResponseHistory filter={visibility.own} format={tab === "casa" ? "HOME" : "DAY"} limit={limit} moreHref={`${tabHref(tab)}&n=${limit + PAGE}`} />
      )}
    </div>
  );
}

function Stat({ value, label, border }: { value: number; label: string; border?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 px-1 py-2.5 ${border ? "border-x-2 border-panel-edge" : ""}`}>
      <span className="font-display text-2xl font-extrabold leading-none text-ink">{value}</span>
      <span className="text-[11px] font-bold text-ink-soft">{label}</span>
    </div>
  );
}

async function ResponseHistory({
  filter,
  format,
  limit,
  moreHref,
}: {
  filter: Prisma.ResponseWhereInput;
  format: "HOME" | "DAY";
  limit: number;
  moreHref: string;
}) {
  const responses = await prisma.response.findMany({
    where: { ...filter, format },
    orderBy: { date: "desc" },
    take: limit + 1,
  });
  const shown = responses.slice(0, limit);
  if (shown.length === 0) {
    return (
      <p className="px-1 text-sm text-ink-soft">
        {format === "DAY" ? "Todavía no hay resúmenes del día. 🦆" : "No hay respuestas del formato anterior. 🦆"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {format === "HOME" ? (
        <p className="px-1 text-xs text-ink-faint">Respuestas de cuando el boletín preguntaba &quot;¿Qué harás al llegar a tu casa?&quot;.</p>
      ) : null}
      <ul className="flex flex-col gap-4">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-col gap-1.5">
            <p className="px-1 text-xs font-bold text-ink-soft">{capitalize(formatLocalDate(describedDate(r)))}</p>
            <div className="bubble flex flex-col gap-1">
              {r.format === "DAY" ? (
                <>
                  {r.mood ? (
                    <span className="chip chip-neutral w-fit text-[11px]">{r.mood}</span>
                  ) : null}
                  <Line label="Hizo" value={r.didToday} />
                  {r.atHome ? <p className="font-bold text-ink">Se quedó en casa.</p> : <Line label="Fue a" value={r.wentWhere} />}
                  <Line label="Comió" value={r.food} />
                  <Line label="Lo mejor" value={r.bestPart} />
                  <Line label="Lo peor" value={r.worstPart} />
                  <Line label="Después" value={r.tomorrowPlan} />
                </>
              ) : (
                <>
                  {r.arrivingLate ? <Line label="Antes de llegar" value={r.beforeHomePlan} /> : null}
                  <Line
                    label={r.atHome ? (r.stayedHome ? "Hoy en casa" : "Al llegar a casa") : "Para dónde va"}
                    value={r.atHome ? r.homePlan : r.awayPlan}
                  />
                  {r.stayedHome ? <Line label="Esta noche" value={r.tonightPlan} /> : null}
                  <Line label="Come" value={r.food} />
                  {r.atHome && !r.stayedHome && !r.arrivingLate ? (
                    <Line label="Sale" value={r.goingOut ? `Sí, a ${r.goingOutWhere}` : "No"} />
                  ) : null}
                </>
              )}
              {r.note ? <p className="bubble-note">&quot;{r.note}&quot;</p> : null}
              {r.photoFilename ? (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/${r.photoFilename}`} alt="" className="h-16 w-16 rounded-lg border border-panel-edge object-cover" />
                  {r.photoDescription ? <p className="text-xs italic text-ink-soft">📷 {r.photoDescription}</p> : null}
                </div>
              ) : null}
              {r.phraseText ? <p className="mt-1 text-xs italic text-ink-soft">💭 &quot;{r.phraseText}&quot;</p> : null}
            </div>
          </li>
        ))}
      </ul>
      {responses.length > limit ? (
        <Link href={moreHref} className="xp-btn-secondary self-center no-underline">
          Ver más
        </Link>
      ) : null}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p>
      <strong className="text-ink">{label}: </strong>
      {value}
    </p>
  );
}

async function MissionHistory({
  ownerId,
  ownerName,
  visibility,
  isMe,
  limit,
}: {
  ownerId: string;
  ownerName: string;
  visibility: ProfileVisibility;
  isMe: boolean;
  limit: number;
}) {
  const include = { mission: true, user: true, target: true } as const;
  const [done, forOwner] = await Promise.all([
    prisma.missionAssignment.findMany({
      where: { userId: ownerId, status: "COMPLETED", response: visibility.own },
      include,
      orderBy: { closedAt: "desc" },
      take: limit,
    }),
    // Las que otros cumplieron para esta persona: solo las que ya salieron en
    // un boletín de un grupo en común (también en el perfil propio, para no
    // arruinar la sorpresa antes de que salga).
    prisma.missionAssignment.findMany({
      where: { targetId: ownerId, status: "COMPLETED", response: visibility.shared },
      include,
      orderBy: { closedAt: "desc" },
      take: limit,
    }),
  ]);

  const section = (title: string, rows: typeof done, who: "target" | "user") => (
    <section className="flex flex-col gap-3">
      <h2 className="form-section">{title}</h2>
      {rows.length ? (
        rows.map((m) => (
          <article key={m.id} className="mission-card flex flex-col gap-1.5 bg-white">
            <p className="text-xs font-bold text-ink-soft">
              {who === "target" ? `Para ${displayName(m.target)}` : `De ${displayName(m.user)}`} · {formatLocalDate(m.date)}
            </p>
            <p className="text-sm font-bold text-ink">{missionText(m.mission.text, m.target)}</p>
            <p className="whitespace-pre-line text-sm text-ink">{m.resolutionText}</p>
            {m.photoFilename ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/${m.photoFilename}`} alt="" className="h-24 w-24 rounded-lg border border-panel-edge object-cover" />
            ) : null}
          </article>
        ))
      ) : (
        <p className="text-sm text-ink-soft">Nada por aquí todavía. 🦆</p>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-6">
      {section(isMe ? "Las que cumpliste" : `Las que cumplió ${ownerName}`, done, "target")}
      {section(isMe ? "Las que hicieron para ti" : `Las que hicieron para ${ownerName}`, forOwner, "user")}
    </div>
  );
}
