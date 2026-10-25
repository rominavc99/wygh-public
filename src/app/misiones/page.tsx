import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { formatLocalDate, localDateOf } from "@/lib/date";
import {
  CANCELS_PER_WEEK,
  MISSIONS_PER_DAY,
  REJECTIONS_PER_DAY,
  STRIKES_TO_BAN,
  SWAPS_PER_OFFER,
  eligibleTargets,
  missionDay,
  missionText,
} from "@/lib/missions";
import { acceptOffer, rejectOffer, requestChosenMission, requestRandomMission, swapOffer } from "./actions";
import { CancelMissionButton } from "./cancel-button";

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: "Cumplida", className: "chip-blue" },
  FAILED: { label: "Incumplida", className: "chip-pink" },
  CANCELLED: { label: "Cancelada", className: "chip-neutral" },
};

export default async function MisionesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await markSeen(session.user.id);
  const userId = session.user.id;
  const { error } = await searchParams;

  const [day, chosenTargets, history] = await Promise.all([
    missionDay(userId),
    eligibleTargets(userId, "chosen"),
    prisma.missionAssignment.findMany({
      where: { userId, status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
      include: { mission: true, target: true },
      orderBy: { closedAt: "desc" },
      take: 15,
    }),
  ]);
  const left = MISSIONS_PER_DAY - day.used;
  const cancelsLeft = CANCELS_PER_WEEK - day.cancelsThisWeek;
  const canRequest = !day.bannedUntil && !day.offer && left > 0 && day.rejections < REJECTIONS_PER_DAY;

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-8 sm:py-10">
      <div className="flex w-full max-w-2xl flex-col gap-5">
        <div className="px-1">
          <h1 className="text-2xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(255,255,255,.6)] sm:text-3xl">🎯 Misiones</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Actividades pequeñas para alguien del grupo. Se entregan dentro de tu resumen del día.
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border-2 border-[var(--nb-line)] px-4 py-2.5 text-sm font-bold text-accent-pink-2" style={{ background: "var(--bubble-2)" }}>
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="win flex flex-col gap-1 p-3">
            <span className="text-xs font-bold text-ink-soft">Hoy</span>
            <span className="font-display text-2xl font-extrabold leading-none text-ink">
              {day.used} <span className="text-sm text-ink-soft">de {MISSIONS_PER_DAY}</span>
            </span>
            <span className="text-xs text-ink-soft">misiones aceptadas</span>
          </div>
          <div className="win flex flex-col gap-1 p-3">
            <span className="text-xs font-bold text-ink-soft">Advertencias</span>
            <div className="flex gap-1.5" role="img" aria-label={`${day.strikes} de ${STRIKES_TO_BAN} advertencias`}>
              {Array.from({ length: STRIKES_TO_BAN }, (_, i) => (
                <span
                  key={i}
                  className="h-5 w-5 rounded-md border-2 border-[var(--nb-line)]"
                  style={{ background: i < day.strikes ? "var(--btn-close-1)" : "#fff" }}
                />
              ))}
            </div>
            <span className="text-xs text-ink-soft">A las {STRIKES_TO_BAN}: una semana fuera</span>
          </div>
        </div>

        {day.bannedUntil ? (
          <div className="win p-4 text-sm text-ink">
            🚫 Juntaste {STRIKES_TO_BAN} advertencias, así que hasta el{" "}
            <strong>{formatLocalDate(localDateOf(day.bannedUntil))}</strong> no puedes aceptar misiones ni salir como
            persona de una. Después empiezas de cero.
          </div>
        ) : null}

        {day.offer ? (
          <section className="win" aria-labelledby="oferta">
            <div className="win-titlebar">
              <span className="win-icon">🎲</span>
              <h2 id="oferta" className="win-title">
                Tu misión
              </h2>
            </div>
            <div className="win-body flex flex-col gap-3" style={{ background: "var(--bubble-3)" }}>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm text-ink-soft">
                  Es para <strong className="font-display text-base text-ink">{displayName(day.offer.target)}</strong>
                </p>
                {day.offer.mission.requiresPhoto ? <span className="chip chip-neutral">Requiere foto</span> : null}
              </div>
              <p className="font-display text-lg font-bold leading-snug text-ink">
                {missionText(day.offer.mission.text, day.offer.target)}
              </p>
              <form action={acceptOffer}>
                <input type="hidden" name="assignmentId" value={day.offer.id} />
                <button type="submit" className="xp-btn w-full">
                  Aceptar misión
                </button>
              </form>
              <div className="grid grid-cols-2 gap-3">
                <form action={swapOffer}>
                  <input type="hidden" name="assignmentId" value={day.offer.id} />
                  <button type="submit" className="xp-btn-secondary min-h-11 w-full" disabled={day.offer.swaps >= SWAPS_PER_OFFER}>
                    Cambiar actividad ({SWAPS_PER_OFFER - day.offer.swaps})
                  </button>
                </form>
                <form action={rejectOffer}>
                  <input type="hidden" name="assignmentId" value={day.offer.id} />
                  <button type="submit" className="xp-btn-secondary min-h-11 w-full">
                    Rechazar
                  </button>
                </form>
              </div>
              <p className="text-xs text-ink-soft">
                &quot;Cambiar actividad&quot; mantiene a {displayName(day.offer.target)}; solo cambia lo que hay que hacer.
              </p>
            </div>
          </section>
        ) : !day.bannedUntil ? (
          <section className="win" aria-labelledby="pedir">
            <div className="win-titlebar">
              <span className="win-icon">🎲</span>
              <h2 id="pedir" className="win-title">
                Pedir una misión
              </h2>
            </div>
            <div className="win-body flex flex-col gap-4">
              {left <= 0 ? (
                <p className="text-sm text-ink-soft">Ya llevas {MISSIONS_PER_DAY} misiones hoy. Vuelve mañana. 🦆</p>
              ) : day.rejections >= REJECTIONS_PER_DAY ? (
                <p className="text-sm text-ink-soft">Ya rechazaste {REJECTIONS_PER_DAY} misiones hoy. Vuelve mañana. 🦆</p>
              ) : (
                <>
                  <form action={requestRandomMission} className="flex flex-col gap-1.5">
                    <button type="submit" className="xp-btn w-full" disabled={!canRequest}>
                      🎲 Misión al azar
                    </button>
                    <p className="text-xs text-ink-faint">La persona y la actividad son sorpresa.</p>
                  </form>
                  <hr className="form-rule" />
                  <form action={requestChosenMission} className="flex flex-col gap-2">
                    <label htmlFor="targetId" className="text-sm font-bold text-ink">
                      O elige para quién
                    </label>
                    <div className="flex gap-2">
                      <select id="targetId" name="targetId" required className="xp-select" defaultValue="">
                        <option value="" disabled>
                          {chosenTargets.length ? "Elige a alguien" : "Nadie disponible ahora"}
                        </option>
                        {chosenTargets.map((t) => (
                          <option key={t.id} value={t.id}>
                            {displayName(t)}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="xp-btn-secondary flex-none" disabled={!canRequest || !chosenTargets.length}>
                        Pedir
                      </button>
                    </div>
                    <p className="text-xs text-ink-faint">La actividad sigue siendo sorpresa.</p>
                  </form>
                </>
              )}
            </div>
          </section>
        ) : null}

        {day.accepted.length || day.completed.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="form-section">Para entregar en tu resumen</h2>
            {day.accepted.length ? (
              <p className="-mt-1 text-sm text-ink-soft">
                Se entregan en el formulario de{" "}
                <Link href="/" className="font-bold underline">
                  Hoy
                </Link>
                , en la sección &quot;Misiones a entregar&quot; (al final, antes de enviar tu resumen).
              </p>
            ) : null}
            {day.accepted.map((a) => (
              <article key={a.id} className="win flex flex-col gap-2.5 p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="chip chip-pink">Para {displayName(a.target)}</span>
                  <span className="chip chip-neutral">Pendiente</span>
                  {a.mission.requiresPhoto ? <span className="chip chip-neutral">Requiere foto</span> : null}
                </div>
                <p className="font-bold text-ink">{missionText(a.mission.text, a.target)}</p>
                <div className="flex justify-end">
                  <CancelMissionButton assignmentId={a.id} cancelsLeft={cancelsLeft} />
                </div>
              </article>
            ))}
            {day.completed.map((a) => (
              <article key={a.id} className="win flex flex-col gap-2 p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="chip chip-pink">Para {displayName(a.target)}</span>
                  <span className="chip chip-blue">Entregada</span>
                </div>
                <p className="font-bold text-ink">{missionText(a.mission.text, a.target)}</p>
                <p className="text-sm text-ink-soft">{a.resolutionText}</p>
              </article>
            ))}
            <p className="rounded-lg border-[2.5px] border-dashed border-[var(--nb-line)] bg-panel p-3 text-sm text-ink">
              <strong>Cancelar no cuenta como advertencia</strong> (te quedan {Math.max(cancelsLeft, 0)} esta semana). Si
              no la entregas ni la cancelas antes de que salga el boletín, sí cuenta.
            </p>
          </section>
        ) : null}

        {history.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="form-section">Historial</h2>
            <ul className="win">
              {history.map((a, i) => (
                <li key={a.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${i ? "border-t-2 border-panel-edge" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <strong>{displayName(a.target)}</strong> · {missionText(a.mission.text, a.target)}
                  </span>
                  <span className={`chip ${STATUS_CHIP[a.status]?.className ?? "chip-neutral"} flex-none`}>
                    {STATUS_CHIP[a.status]?.label ?? a.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="px-1 text-xs text-ink-faint">
          ¿No quieres salir como persona de las misiones de otros? Puedes pedirlo en{" "}
          <Link href="/perfil/ajustes" className="underline">
            los ajustes de tu perfil
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
