import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { addDaysLocal, formatLocalDate, todayLocalDate } from "@/lib/date";
import { ResponseForm, type DayWord } from "./response-form";
import { BirthdayPrompt } from "./birthday-prompt";
import { DEFAULT_GREETING_EMOJI } from "@/lib/user-schema";
import { openResponseDate, responseGroupOptions, responseLock } from "@/lib/groups";
import { deliverableMissions } from "@/lib/missions";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await markSeen(session.user.id);

  // `date` es la fecha del boletín al que va el resumen; el resumen habla
  // del día anterior (ver openResponseDate).
  const date = await openResponseDate(session.user.id);
  const today = todayLocalDate();
  const described = addDaysLocal(date, -1);
  const dayWord: DayWord = described === today ? "hoy" : "ayer";

  const [existing, settings, me, missions, groups] = await Promise.all([
    prisma.response.findUnique({ where: { userId_date: { userId: session.user.id, date } } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { birthday: true, birthdayPromptDismissed: true, greetingEmoji: true },
    }),
    deliverableMissions(session.user.id, date),
    prisma.group.findMany({
      where: { suspended: false, members: { some: { userId: session.user.id } } },
      select: { sendTime: true },
      orderBy: { sendTime: "asc" },
    }),
  ]);
  const groupOptions = await responseGroupOptions(session.user.id, date, existing?.id ?? null);
  const noGroups = groupOptions.length === 0;
  const { locked, allowedGroupIds } = responseLock(groupOptions, Boolean(existing), settings.lockResponsesAfterSend);
  // Los grupos cuyo boletín ya salió se muestran (deshabilitados) para que
  // se entienda por qué no se pueden elegir.
  const formGroups = groupOptions.map((o) => ({
    id: o.id,
    name: o.name,
    checked: o.selected,
    disabled: !allowedGroupIds.includes(o.id),
  }));
  const sendTime = groups[0]?.sendTime;
  const pendingMissions = missions.filter((m) => !m.resolutionText).length;
  // Un resumen del formato anterior no se edita con el formulario nuevo.
  const editable = existing?.format === "DAY" ? existing : null;

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-8 sm:py-10">
      <div className="flex w-full max-w-2xl flex-col gap-5">
        <div className="px-1">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft drop-shadow-[0_1px_2px_rgba(255,255,255,.6)] capitalize">
            {formatLocalDate(described)}
          </p>
          <h1 className="text-2xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(255,255,255,.6)] sm:text-3xl">
            Hola, {session.user.name} {me?.greetingEmoji ?? DEFAULT_GREETING_EMOJI}
          </h1>
          {noGroups ? null : (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="chip chip-blue">Resumen de {dayWord}</span>
              {sendTime ? (
                <span className="chip chip-neutral">
                  Se envía {date === today ? "hoy" : "mañana"} a las {sendTime}
                </span>
              ) : null}
            </div>
          )}
        </div>

        {me && !me.birthday && !me.birthdayPromptDismissed ? <BirthdayPrompt /> : null}

        {pendingMissions && !locked ? (
          <Link
            href="/misiones"
            className="win flex items-center gap-3 px-4 py-3 text-sm text-ink no-underline"
            style={{ background: "var(--bubble-3)" }}
          >
            <span aria-hidden="true" className="text-xl">
              🎯
            </span>
            <span className="flex-1">
              <strong>
                {pendingMissions} {pendingMissions === 1 ? "misión" : "misiones"} por entregar.
              </strong>{" "}
              Van dentro de este resumen.
            </span>
            <span aria-hidden="true" className="font-bold text-chrome-4">
              ›
            </span>
          </Link>
        ) : null}

        <div className="win">
          <div className="win-titlebar">
            <span className="win-icon">{noGroups ? "🫂" : locked ? "🔒" : "📝"}</span>
            <span className="win-title">
              {noGroups ? "Todavía no estás en un grupo" : locked ? "Tu resumen (bloqueado)" : "Resumen del día"}
            </span>
            <div className="win-btns">
              <div className="win-btn">_</div>
              <div className="win-btn">□</div>
              <div className="win-btn close">×</div>
            </div>
          </div>

          {noGroups ? null : locked ? (
            <div className="mx-5 mt-4 rounded-lg border border-panel-edge bg-panel-2 px-4 py-2.5 text-sm font-bold text-accent-pink-2">
              {existing
                ? "🔒 El boletín ya se envió, así que tu resumen ya no se puede editar."
                : "🔒 El boletín ya se envió. Ya no puedes mandar este resumen."}
            </div>
          ) : existing ? (
            <div className="mx-5 mt-4 rounded-lg border border-panel-edge bg-panel-2 px-4 py-2.5 text-sm font-bold text-accent-pink-2">
              Ya mandaste tu resumen. Puedes actualizarlo hasta que salga el boletín.
            </div>
          ) : null}

          <div className="win-body">
            {noGroups ? (
              <p className="text-sm text-ink-soft">
                Todavía no estás en ningún grupo, así que por ahora no hay boletín al cual mandar tu resumen. Cuando
                un admin te agregue a uno (o abras el enlace de invitación que te manden), aquí te va a aparecer el
                formulario. 🦆
              </p>
            ) : locked && existing ? (
              <div className="bubble flex flex-col gap-1">
                {existing.format === "DAY" ? (
                  <>
                    <p>
                      <strong className="text-ink">Hizo: </strong>
                      {existing.didToday}
                    </p>
                    <p>
                      <strong className="text-ink">{existing.atHome ? "Se quedó en casa." : "Fue a: "}</strong>
                      {existing.atHome ? null : existing.wentWhere}
                    </p>
                    {existing.food ? (
                      <p>
                        <strong className="text-ink">Comió: </strong>
                        {existing.food}
                      </p>
                    ) : null}
                    {existing.bestPart ? (
                      <p>
                        <strong className="text-ink">Lo mejor: </strong>
                        {existing.bestPart}
                      </p>
                    ) : null}
                    {existing.worstPart ? (
                      <p>
                        <strong className="text-ink">Lo peor: </strong>
                        {existing.worstPart}
                      </p>
                    ) : null}
                    {existing.tomorrowPlan ? (
                      <p>
                        <strong className="text-ink">Después: </strong>
                        {existing.tomorrowPlan}
                      </p>
                    ) : null}
                    {existing.mood ? (
                      <p>
                        <strong className="text-ink">Estado: </strong>
                        {existing.mood}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p>
                    <strong className="text-ink">Al llegar a casa: </strong>
                    {existing.atHome ? existing.homePlan : existing.awayPlan}
                  </p>
                )}
                {existing.note ? <p className="bubble-note">&quot;{existing.note}&quot;</p> : null}
                {existing.photoFilename ? (
                  <div className="mt-2 flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/${existing.photoFilename}`}
                      alt=""
                      className="h-16 w-16 rounded-lg border border-panel-edge object-cover"
                    />
                    {existing.photoDescription ? (
                      <p className="text-xs italic text-ink-soft">📷 {existing.photoDescription}</p>
                    ) : null}
                  </div>
                ) : null}
                {existing.phraseText ? (
                  <p className="mt-1 text-xs italic text-ink-soft">💭 &quot;{existing.phraseText}&quot;</p>
                ) : null}
              </div>
            ) : locked ? (
              <p className="text-sm text-ink-soft">No alcanzaste a mandar este resumen. 🦆</p>
            ) : (
              /* key fuerza un remount cuando cambian los datos guardados: sin
                 esto, tras una Server Action exitosa los checkboxes/radios
                 controlados pueden quedar visualmente desincronizados del
                 estado real. Remontar con datos frescos del servidor lo evita. */
              <ResponseForm
                key={existing?.updatedAt.getTime() ?? "new"}
                existing={editable}
                draftKey={`wygh:borrador:${session.user.id}:${date}`}
                groups={formGroups}
                missions={missions}
                dayWord={dayWord}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
