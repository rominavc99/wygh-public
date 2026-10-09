import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { todayLocalDate, formatLocalDate } from "@/lib/date";
import { ResponseForm } from "./response-form";
import { SignOutButton } from "./sign-out-button";
import { BirthdayPrompt } from "./birthday-prompt";
import { DEFAULT_GREETING_EMOJI } from "@/lib/user-schema";
import { unreadNotificationCount } from "@/lib/notifications";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await markSeen(session.user.id);

  const date = todayLocalDate();
  const [existing, settings, todaysSend, me, unread] = await Promise.all([
    prisma.response.findUnique({ where: { userId_date: { userId: session.user.id, date } } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.newsletterSend.findUnique({ where: { date } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { birthday: true, birthdayPromptDismissed: true, greetingEmoji: true },
    }),
    unreadNotificationCount(session.user.id),
  ]);
  const locked = settings.lockResponsesAfterSend && Boolean(todaysSend);

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-5 px-1">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft drop-shadow-[0_1px_2px_rgba(255,255,255,.6)] capitalize">
            {formatLocalDate(date)}
          </p>
          <h1 className="text-2xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
            Hola, {session.user.name} {me?.greetingEmoji ?? DEFAULT_GREETING_EMOJI}
          </h1>
        </div>

        {me && !me.birthday && !me.birthdayPromptDismissed ? <BirthdayPrompt /> : null}

        <div className="win">
          <div className="win-titlebar">
            <span className="win-icon">{locked ? "🔒" : "💬"}</span>
            <span className="win-title">
              {locked ? "Tu respuesta de hoy (bloqueada)" : existing ? "Tu respuesta de hoy" : "¿Qué harás al llegar?"}
            </span>
            <div className="win-btns">
              <div className="win-btn">_</div>
              <div className="win-btn">□</div>
              <div className="win-btn close">×</div>
            </div>
          </div>
          <div className="win-toolbar">
            <Link href="/mis-respuestas" className="whitespace-nowrap hover:text-chrome-4">
              📋 Mis respuestas
            </Link>
            <Link href="/boletines" className="whitespace-nowrap hover:text-chrome-4">
              📬 Boletines
            </Link>
            <Link href="/notificaciones" className="whitespace-nowrap hover:text-chrome-4">
              🔔 Notificaciones
              {unread ? (
                <span className="ml-1 rounded-full bg-accent-pink px-1.5 py-px text-[11px] font-bold text-white" aria-label={`${unread} sin leer`}>
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <Link href="/perfil" className="whitespace-nowrap hover:text-chrome-4">
              👤 Mi perfil
            </Link>
            {session.user.role === "ADMIN" ? (
              <Link href="/admin" className="text-accent-pink-2 whitespace-nowrap hover:text-chrome-4">
                ⚙️ Panel admin
              </Link>
            ) : null}
            <SignOutButton />
          </div>

          {locked ? (
            <div className="mx-5 mt-4 rounded-lg border border-panel-edge bg-panel-2 px-4 py-2.5 text-sm font-bold text-accent-pink-2">
              {existing
                ? "🔒 El boletín de hoy ya se envió, así que tu respuesta ya no se puede editar."
                : "🔒 El boletín de hoy ya se envió. Ya no puedes responder por hoy."}
            </div>
          ) : existing ? (
            <div className="mx-5 mt-4 rounded-lg border border-panel-edge bg-panel-2 px-4 py-2.5 text-sm font-bold text-accent-pink-2">
              Ya enviaste tu respuesta de hoy. Puedes actualizarla cuando quieras.
            </div>
          ) : null}

          <div className="win-body">
            {locked && existing ? (
              <div className="bubble">
                {existing.arrivingLate && existing.beforeHomePlan ? (
                  <p>
                    <strong className="text-ink">Antes de llegar: </strong>
                    {existing.beforeHomePlan}
                  </p>
                ) : null}
                <p>
                  <strong className="text-ink">
                    {existing.atHome
                      ? existing.stayedHome
                        ? "Hoy en casa: "
                        : "Al llegar a casa: "
                      : "Para dónde va: "}
                  </strong>
                  {existing.atHome ? existing.homePlan : existing.awayPlan}
                </p>
                {existing.stayedHome && existing.tonightPlan ? (
                  <p>
                    <strong className="text-ink">Esta noche: </strong>
                    {existing.tonightPlan}
                  </p>
                ) : null}
                <p>
                  <strong className="text-ink">Come: </strong>
                  {existing.food}
                </p>
                {existing.atHome && !existing.stayedHome && !existing.arrivingLate ? (
                  <p>
                    <strong className="text-ink">Sale: </strong>
                    {existing.goingOut ? `Sí, a ${existing.goingOutWhere}` : "No"}
                  </p>
                ) : null}
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
              <p className="text-sm text-ink-soft">No alcanzaste a responder hoy. 🦆</p>
            ) : (
              /* key fuerza un remount cuando cambian los datos guardados: sin
                 esto, tras una Server Action exitosa los checkboxes/radios
                 controlados pueden quedar visualmente desincronizados del
                 estado real. Remontar con datos frescos del servidor lo evita. */
              <ResponseForm
                key={existing?.updatedAt.getTime() ?? "new"}
                existing={existing}
                draftKey={`wygh:borrador:${session.user.id}:${date}`}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
