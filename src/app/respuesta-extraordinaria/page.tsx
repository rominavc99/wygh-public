import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { addDaysLocal, formatLocalDate, todayLocalDate } from "@/lib/date";
import { capitalize } from "@/lib/newsletter";
import { EXTRAORDINARY_PATH, usableGrants, recentlyUsedGrants } from "@/lib/extraordinary";
import { ResponseForm } from "../response-form";
import { saveExtraordinaryResponse } from "./actions";

/**
 * Respuesta para un día pasado, solo con un permiso de un solo uso que da
 * un admin desde Ajustes (ver src/lib/extraordinary.ts). El admin comparte
 * el enlace a mano o le llega a la persona en el correo del privilegio.
 * Un admin siempre ve el formulario y puede elegir cualquier día pasado,
 * aunque la página esté deshabilitada.
 */
export default async function RespuestaExtraordinariaPage() {
  const session = await auth();
  if (!session?.user) redirect(`/login?${new URLSearchParams({ callbackUrl: EXTRAORDINARY_PATH })}`);
  await markSeen(session.user.id);

  const [settings, grants, used] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    usableGrants(session.user.id),
    // Las que acaba de mandar, para confirmarle que ya quedaron.
    recentlyUsedGrants(session.user.id),
  ]);
  const enabled = settings.extraordinaryResponsesEnabled;
  const available = enabled ? grants : [];
  const isAdmin = session.user.role === "ADMIN";
  const showForm = isAdmin || available.length > 0;

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              Privilegio especial
            </p>
            <h1 className="text-2xl font-bold text-ink drop-shadow-[0_1px_2px_rgba(255,255,255,.6)]">
              👑 Respuesta extraordinaria
            </h1>
          </div>
          <Link href="/" className="chip chip-blue">
            ← Volver al formulario
          </Link>
        </div>

        <div className="win">
          <div className="win-titlebar">
            <span className="win-icon">{showForm ? "👑" : "🔒"}</span>
            <span className="win-title">{showForm ? "Solo para ti" : "Respuesta extraordinaria"}</span>
            <div className="win-btns">
              <div className="win-btn">_</div>
              <div className="win-btn">□</div>
              <Link href="/" className="win-btn close" aria-label="Volver al formulario">
                ×
              </Link>
            </div>
          </div>

          {used.length ? (
            <div className="mx-5 mt-4 flex flex-col gap-1 rounded-lg border border-panel-edge bg-panel-2 px-4 py-2.5 text-sm font-bold text-accent-pink-2">
              {used.map((g) => (
                <p key={g.id}>
                  ✨ Tu respuesta del {formatLocalDate(g.date)} ya está en el boletín.{" "}
                  <Link href={`/boletines?date=${g.date}`} className="underline">
                    Verla →
                  </Link>
                </p>
              ))}
            </div>
          ) : null}

          <div className="win-body">
            {isAdmin ? (
              <div className="flex flex-col gap-5">
                <p className="text-sm text-ink-soft">
                  Como admin puedes mandar tu respuesta para cualquier día que ya pasó y en el que no hayas
                  respondido, aunque la página esté deshabilitada. Se agrega al boletín de ese día en el sitio (el
                  correo no se vuelve a enviar) y al resto del grupo le llega el aviso de actualizaciones.
                </p>
                {/* key: tras guardar, el formulario se vuelve a montar vacío. */}
                <ResponseForm
                  key={used.map((g) => g.id).join(",")}
                  existing={null}
                  draftKey={`wygh:extraordinaria:${session.user.id}`}
                  action={saveExtraordinaryResponse}
                  dateMax={addDaysLocal(todayLocalDate(), -1)}
                />
              </div>
            ) : available.length ? (
              <div className="flex flex-col gap-5">
                <p className="text-sm text-ink-soft">
                  El admin te dio un privilegio que casi nadie tiene: mandar tu respuesta para un día que ya pasó,
                  porque ese día la app te falló. Se agrega al boletín de ese día en el sitio (el correo no se
                  vuelve a enviar). Es de un solo uso.
                </p>
                {/* key: tras guardar, el formulario se vuelve a montar vacío
                    y sin el día que ya se usó (si le quedan otros). */}
                <ResponseForm
                  key={available.map((g) => g.date).join(",")}
                  existing={null}
                  draftKey={`wygh:extraordinaria:${session.user.id}`}
                  action={saveExtraordinaryResponse}
                  dateOptions={available.map((g) => ({ value: g.date, label: capitalize(formatLocalDate(g.date)) }))}
                />
              </div>
            ) : (
              <p className="text-sm text-ink-soft">
                {used.length
                  ? "Ya no te quedan respuestas extraordinarias por mandar. ¡Gracias! 🦆"
                  : "Esta página solo funciona con un privilegio especial del admin, y ahora no tienes uno activo. 🦆"}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
