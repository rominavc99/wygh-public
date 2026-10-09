import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDaysLocal, todayLocalDate } from "@/lib/date";
import { getParticipationStats, type UserStats } from "@/lib/participation-stats";
import { WEEKDAY_NAMES } from "@/lib/weekdays";

const RANGES = [
  { key: "7", label: "7 días", days: 7 },
  { key: "30", label: "30 días", days: 30 },
  { key: "90", label: "90 días", days: 90 },
  { key: "todo", label: "Todo", days: null },
] as const;

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Alinea el tooltip hacia adentro en las barras de las orillas. */
function tipEdge(index: number, total: number): string {
  if (total < 4) return "";
  if (index < total / 4) return "viz-tip-start";
  if (index >= (total * 3) / 4) return "viz-tip-end";
  return "";
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const params = await searchParams;
  const range = RANGES.find((r) => r.key === params.dias) ?? RANGES[1];
  const today = todayLocalDate();
  const [stats, settings] = await Promise.all([
    getParticipationStats({ from: range.days ? addDaysLocal(today, -range.days) : null, to: today }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);

  const { totals } = stats;
  const groupRate = totals.eligible ? totals.responses / totals.eligible : null;
  const ranked = [...stats.users]
    .filter((u) => u.rate !== null)
    .sort((a, b) => b.rate! - a.rate! || b.responses - a.responses || a.name.localeCompare(b.name));
  const missing = [...stats.users]
    .filter((u) => u.missedStreak > 0)
    .sort((a, b) => b.missedStreak - a.missedStreak || a.name.localeCompare(b.name));
  const absent = [...stats.users]
    .filter((u) => u.daysSinceVisit >= settings.inactivityNudgeDays)
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit || a.name.localeCompare(b.name));
  const byResponses = [...stats.users].sort((a, b) => b.responses - a.responses || a.name.localeCompare(b.name));
  const avgPerDay = stats.days.length ? totals.responses / stats.days.length : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">📊 Estadísticas</h2>
        <p className="text-sm text-ink-soft">
          Participación de las personas activas. Solo cuentan los días en que salió el boletín, y a
          cada quien desde el día en que lo dieron de alta.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Periodo">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/estadisticas?dias=${r.key}`}
            className={`chip ${r.key === range.key ? "chip-pink" : "chip-neutral"}`}
            aria-current={r.key === range.key ? "page" : undefined}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {stats.days.length === 0 ? (
        <p className="text-sm text-ink-soft">Todavía no hay boletines enviados en este periodo.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Participación" value={pct(groupRate)} hint={`${totals.responses} de ${totals.eligible} posibles`} />
            <Tile
              label="Respuestas por día"
              value={avgPerDay === null ? "—" : avgPerDay.toFixed(1)}
              hint={plural(stats.days.length, "día con boletín", "días con boletín")}
            />
            <Tile label="Días con todos" value={String(totals.perfectDays)} hint="respondió todo el grupo" />
            <Tile
              label="Interacción"
              value={String(totals.reactions + totals.comments)}
              hint={`${totals.reactions} reacciones · ${totals.comments} comentarios`}
            />
          </div>

          <Section title="Participación diaria" hint="Qué porcentaje de quienes les tocaba respondió cada día.">
            <DailyChart daily={stats.daily} />
          </Section>

          <Section
            title="Quién participa más (y quién menos)"
            hint="Respuestas sobre los días que le tocaban en el periodo."
          >
            <ul className="flex flex-col gap-1.5">
              {ranked.map((u, i) => (
                <li key={u.id} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate font-bold text-ink" title={u.name}>
                    {i === 0 ? "🏆 " : ""}
                    {u.name}
                  </span>
                  <div className="viz-hit viz-track h-4 rounded-r" tabIndex={0}>
                    <div className="viz-bar-h h-full" style={{ width: `${(u.rate ?? 0) * 100}%` }} />
                    <span className="viz-tip">
                      {u.name}: {u.responses} de {u.eligibleDays} días
                    </span>
                  </div>
                  <span className="tabular-nums text-ink-soft">
                    {u.responses}/{u.eligibleDays} · <strong className="text-ink">{pct(u.rate)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Días seguidos sin responder"
            hint={`Hasta hoy, sin importar el periodo elegido. Con ${settings.inactivityNudgeDays} o más le llega el correo de "sándwich remojado"${settings.inactivityNudgeEnabled ? "" : " (ahora desactivado en Ajustes)"}.`}
          >
            {missing.length === 0 ? (
              <p className="text-sm text-ink-soft">✨ Todo el mundo respondió el último boletín.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {missing.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-panel-edge bg-panel px-3 py-2"
                  >
                    <div>
                      <p className="font-bold text-ink">{u.name}</p>
                      <p className="text-xs text-ink-soft">
                        Última respuesta: {u.lastResponseDate ? shortDate(u.lastResponseDate) : "nunca"}
                      </p>
                    </div>
                    <span className={`chip ${u.missedStreak >= settings.inactivityNudgeDays ? "chip-pink" : "chip-neutral"}`}>
                      {u.missedStreak >= settings.inactivityNudgeDays ? "🥪 " : ""}
                      {plural(u.missedStreak, "día", "días")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Sin entrar al sitio"
            hint={`${settings.inactivityNudgeDays} días o más sin abrir la página (ni para leer, responder o reaccionar). Leer solo el correo no cuenta.`}
          >
            {absent.length === 0 ? (
              <p className="text-sm text-ink-soft">✨ Todo el mundo ha entrado en los últimos días.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {absent.map((u) => (
                  <li key={u.id} className="chip chip-neutral" title={u.lastVisitDate ? `Última visita: ${shortDate(u.lastVisitDate)}` : "Sin visitas registradas"}>
                    {u.name} · {plural(u.daysSinceVisit, "día", "días")}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Participación por día de la semana" hint="Para ver qué días se le olvida más al grupo.">
            <WeekdayChart weekdays={stats.weekdays} />
          </Section>

          <Section title="Detalle por persona" hint="Rachas, hora típica de respuesta e interacción en el periodo.">
            <UserTable users={byResponses} />
          </Section>

          <Section title="Datos curiosos">
            <ul className="flex flex-col gap-1.5 text-sm text-ink">
              <li>
                🏠 Llegó a casa en <strong>{pct(totals.responses ? totals.atHome / totals.responses : null)}</strong> de
                las respuestas.
              </li>
              <li>
                🎉 Salió después en <strong>{pct(totals.responses ? totals.goingOut / totals.responses : null)}</strong>.
              </li>
              <li>
                📸 {plural(totals.photos, "foto compartida", "fotos compartidas")}.
              </li>
              <EarlyLate users={stats.users} />
            </ul>
            {stats.foods.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-bold text-ink">🍽️ Las comidas que más se repiten</p>
                <ul className="flex flex-wrap gap-2">
                  {stats.foods.map((f) => (
                    <li key={f.label} className="chip chip-blue">
                      {f.label} · {f.count}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-panel-edge bg-panel-2 p-3">
      <p className="text-xs font-bold text-ink-soft">{label}</p>
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-faint">{hint}</p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-panel-edge bg-panel-2 p-4">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {hint ? <p className="mb-3 text-xs text-ink-faint">{hint}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function DailyChart({ daily }: { daily: { date: string; responded: number; eligible: number }[] }) {
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between text-right text-[11px] tabular-nums text-ink-faint">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div className="relative h-40 flex-1">
          <div className="viz-grid absolute inset-x-0 top-0" />
          <div className="viz-grid absolute inset-x-0 top-1/2" />
          <div className="viz-grid absolute inset-x-0 bottom-0" />
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {daily.map((d, i) => {
              const rate = d.eligible ? d.responded / d.eligible : 0;
              return (
                <div key={d.date} className="viz-hit flex h-full min-w-0 flex-1 items-end" tabIndex={0}>
                  <div className="viz-bar w-full" style={{ height: `${Math.max(rate * 100, rate > 0 ? 2 : 0)}%` }} />
                  <span className={`viz-tip ${tipEdge(i, daily.length)}`}>
                    {shortDate(d.date)}: {d.responded} de {d.eligible} ({pct(d.eligible ? rate : null)})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-1 flex justify-between pl-10 text-[11px] text-ink-faint">
        <span>{shortDate(daily[0].date)}</span>
        {daily.length > 2 ? <span>{shortDate(daily[Math.floor(daily.length / 2)].date)}</span> : null}
        <span>{shortDate(daily[daily.length - 1].date)}</span>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-bold text-ink-soft">Ver como tabla</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1">Día</th>
              <th className="py-1 text-right">Respondieron</th>
              <th className="py-1 text-right">%</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-ink">
            {[...daily].reverse().map((d) => (
              <tr key={d.date} className="border-t border-panel-edge">
                <td className="py-1">{shortDate(d.date)}</td>
                <td className="py-1 text-right">
                  {d.responded} de {d.eligible}
                </td>
                <td className="py-1 text-right">{pct(d.eligible ? d.responded / d.eligible : null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function WeekdayChart({ weekdays }: { weekdays: { weekday: number; responded: number; eligible: number }[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {weekdays.map((w) => {
        const rate = w.eligible ? w.responded / w.eligible : null;
        return (
          <li key={w.weekday} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="font-bold text-ink">{WEEKDAY_NAMES[w.weekday]}</span>
            <div className="viz-hit viz-track h-4 rounded-r" tabIndex={0}>
              <div className="viz-bar-h h-full" style={{ width: `${(rate ?? 0) * 100}%` }} />
              <span className="viz-tip">
                {w.eligible ? `${w.responded} de ${w.eligible} respuestas posibles` : "Sin boletines ese día"}
              </span>
            </div>
            <span className="text-right tabular-nums text-ink-soft">{pct(rate)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function UserTable({ users }: { users: UserStats[] }) {
  const columns: { label: string; title: string; value: (u: UserStats) => string | number }[] = [
    { label: "Resp.", title: "Respuestas en el periodo", value: (u) => u.responses },
    { label: "%", title: "Participación en el periodo", value: (u) => pct(u.rate) },
    { label: "Racha", title: "Días seguidos respondiendo (actual)", value: (u) => u.currentStreak },
    { label: "Mejor", title: "Mejor racha del periodo", value: (u) => u.longestStreak },
    { label: "Sin resp.", title: "Días seguidos sin responder hasta hoy", value: (u) => u.missedStreak },
    { label: "Hora", title: "Hora típica a la que responde", value: (u) => u.typicalTime ?? "—" },
    { label: "Visita", title: "Última vez que entró al sitio", value: (u) => (u.lastVisitDate ? shortDate(u.lastVisitDate) : "—") },
    { label: "❤️ dadas", title: "Reacciones que dio", value: (u) => u.reactionsGiven },
    { label: "❤️ recib.", title: "Reacciones que recibió", value: (u) => u.reactionsReceived },
    { label: "💬 dados", title: "Comentarios que hizo", value: (u) => u.commentsGiven },
    { label: "💬 recib.", title: "Comentarios que recibió", value: (u) => u.commentsReceived },
    { label: "📸", title: "Fotos compartidas", value: (u) => u.photos },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-left text-xs">
        <thead className="text-ink-soft">
          <tr>
            <th className="py-1.5 pr-2">Persona</th>
            {columns.map((c) => (
              <th key={c.label} className="px-1.5 py-1.5 text-right" title={c.title}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums text-ink">
          {users.map((u) => (
            <tr key={u.id} className="border-t border-panel-edge">
              <td className="py-1.5 pr-2 font-bold">{u.name}</td>
              {columns.map((c) => (
                <td key={c.label} className="px-1.5 py-1.5 text-right">
                  {c.value(u)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EarlyLate({ users }: { users: UserStats[] }) {
  const timed = users.filter((u) => u.typicalTime).sort((a, b) => a.typicalTime!.localeCompare(b.typicalTime!));
  if (timed.length < 2) return null;
  const early = timed[0];
  const late = timed[timed.length - 1];
  return (
    <>
      <li>
        🐓 Responde más temprano: <strong>{early.name}</strong> (como a las {early.typicalTime}).
      </li>
      <li>
        ⏳ Responde más al último: <strong>{late.name}</strong> (como a las {late.typicalTime}).
      </li>
    </>
  );
}
