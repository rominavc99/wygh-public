import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatLocalDate, todayLocalDate } from "@/lib/date";
import { avatarGradient } from "@/lib/avatar";

export default async function MisRespuestasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const responses = await prisma.response.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  });

  const today = todayLocalDate();
  const userName = session.user.name ?? "?";
  const initial = userName.charAt(0).toUpperCase();
  const gradient = avatarGradient(userName);

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-5 flex items-start justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              Historial
            </p>
            <h1 className="text-2xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              Mis respuestas
            </h1>
          </div>
          <Link href="/" className="chip chip-blue">
            ← Volver al formulario
          </Link>
        </div>

        <div className="win">
          <div className="win-titlebar">
            <span className="win-icon">📋</span>
            <span className="win-title">Mis respuestas</span>
            <div className="win-btns">
              <div className="win-btn">_</div>
              <div className="win-btn">□</div>
              <Link href="/" className="win-btn close" aria-label="Volver al formulario">
                ×
              </Link>
            </div>
          </div>
          <div className="win-toolbar">
            <span>{responses.length} respuesta{responses.length === 1 ? "" : "s"} en total</span>
          </div>

          <div className="win-body">
            <ul className="flex flex-col gap-4">
              {responses.map((r) => (
                <li key={r.id} className="flex items-start gap-3">
                  <div className="avatar" style={{ background: gradient }}>
                    {initial}
                  </div>
                  <div className="bubble">
                    <p className="bubble-name capitalize">
                      {formatLocalDate(r.date)}
                      {r.date === today ? (
                        <span className="chip chip-pink ml-2 align-middle text-[10px]">Hoy</span>
                      ) : null}
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
              ))}
              {responses.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  Todavía no has respondido ningún día. 🦆
                </p>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
