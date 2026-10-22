import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JOIN_PATH } from "@/lib/groups";
import { JoinButton } from "./join-button";

/**
 * Enlace de invitación a un grupo (ver Group.inviteToken). Pide sesión: el
 * enlace no crea cuentas, solo une a gente que ya tiene una. Unirse es un
 * botón y no algo que pase al abrir la página, porque algunos correos abren
 * los enlaces solos para revisarlos.
 */
export default async function UnirsePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?${new URLSearchParams({ callbackUrl: `${JOIN_PATH}/${token}` })}`);

  const group = await prisma.group.findUnique({
    where: { inviteToken: token },
    include: { members: { where: { userId: session.user.id }, select: { userId: true } } },
  });

  let body: React.ReactNode;
  if (!group) {
    body = <p className="text-ink">Este enlace ya no sirve. Pídele a quien te lo mandó uno nuevo.</p>;
  } else if (group.members.length > 0) {
    body = (
      <div className="flex flex-col items-center gap-3">
        <p className="text-ink">
          Ya estás en <strong>{group.name}</strong>. 💕
        </p>
        <Link href="/" className="xp-btn">
          Ir a responder →
        </Link>
      </div>
    );
  } else if (group.suspended) {
    body = (
      <p className="text-ink">
        <strong>{group.name}</strong> está en pausa por ahora. Vuelve a intentarlo más adelante.
      </p>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-4">
        <p className="text-ink">
          Te invitaron a <strong>{group.name}</strong>. Al unirte vas a recibir su boletín y podrás mandarle tus
          respuestas del día.
        </p>
        <JoinButton token={token} groupName={group.name} />
      </div>
    );
  }

  return (
    <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
      <div className="win w-full max-w-md">
        <div className="win-titlebar">
          <span className="win-icon">💌</span>
          <span className="win-title">Invitación a un grupo</span>
          <div className="win-btns">
            <div className="win-btn">_</div>
            <div className="win-btn">□</div>
            <Link href="/" className="win-btn close" aria-label="Volver al inicio">
              ×
            </Link>
          </div>
        </div>
        <div className="win-body text-center">{body}</div>
      </div>
    </main>
  );
}
