import { prisma } from "@/lib/prisma";
import { todayLocalDate, formatLocalDate } from "@/lib/date";
import { avatarGradient } from "@/lib/avatar";
import { displayName } from "@/lib/display-name";

export default async function RespuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || todayLocalDate();

  const [responses, activeUsers] = await Promise.all([
    prisma.response.findMany({
      where: { date },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const respondedIds = new Set(responses.map((r) => r.userId));
  const missing = activeUsers.filter((u) => !respondedIds.has(u.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">🗂️ Respuestas</h2>
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
        <span className="chip chip-pink">{responses.length} respondieron</span>
        <span className="chip chip-neutral">{missing.length} sin responder</span>
      </div>

      {missing.length > 0 ? (
        <p className="text-sm text-ink-soft">Faltan: {missing.map((u) => u.name).join(", ")}</p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {responses.map((r) => {
          const name = displayName(r.user);
          return (
          <li key={r.id} className="flex items-start gap-3">
            <div className="avatar" style={{ background: avatarGradient(name) }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="bubble">
              <p className="bubble-name">
                {name}
                {r.user.username ? <span className="text-xs font-normal text-ink-soft"> ({r.user.name})</span> : null}
              </p>
              {r.arrivingLate && r.beforeHomePlan ? (
                <p>
                  <strong className="text-ink">Antes de llegar: </strong>
                  {r.beforeHomePlan}
                </p>
              ) : null}
              <p>
                <strong className="text-ink">
                  {r.atHome ? (r.stayedHome ? "Hoy en casa: " : "Al llegar a casa: ") : "Para dónde va: "}
                </strong>
                {r.atHome ? r.homePlan : r.awayPlan}
              </p>
              {r.stayedHome && r.tonightPlan ? (
                <p>
                  <strong className="text-ink">Esta noche: </strong>
                  {r.tonightPlan}
                </p>
              ) : null}
              <p>
                <strong className="text-ink">Come: </strong>
                {r.food}
              </p>
              {r.atHome && !r.stayedHome && !r.arrivingLate ? (
                <p>
                  <strong className="text-ink">Sale: </strong>
                  {r.goingOut ? `Sí, a ${r.goingOutWhere}` : "No"}
                </p>
              ) : null}
              {r.note ? <p className="bubble-note">&quot;{r.note}&quot;</p> : null}
              {r.photoFilename ? (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/${r.photoFilename}`}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-panel-edge object-cover"
                  />
                  {r.photoDescription ? (
                    <p className="text-xs italic text-ink-soft">📷 {r.photoDescription}</p>
                  ) : null}
                </div>
              ) : null}
              {r.phraseText ? (
                <p className="mt-1 text-xs italic text-ink-soft">💭 &quot;{r.phraseText}&quot;</p>
              ) : null}
            </div>
          </li>
          );
        })}
        {responses.length === 0 ? (
          <p className="text-sm text-ink-soft">Nadie ha respondido este día. Todos son unos sandwiches remojados</p>
        ) : null}
      </ul>
    </div>
  );
}
