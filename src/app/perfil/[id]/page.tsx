import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { profileTab } from "@/lib/profile";
import { eligibleTargets } from "@/lib/missions";
import { requestChosenMission } from "@/app/misiones/actions";
import { ProfileView } from "../profile-view";

/** Perfil de otra persona del grupo (el propio vive en /perfil). */
export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; n?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await markSeen(session.user.id);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (id === session.user.id) redirect("/perfil");

  const owner = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, username: true } });
  if (!owner) notFound();
  const canAskMission = (await eligibleTargets(session.user.id, "chosen")).some((t) => t.id === id);

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-8 sm:py-10">
      <div className="flex w-full max-w-2xl flex-col gap-5">
        <ProfileView
          ownerId={id}
          viewer={session.user}
          tab={profileTab(query.tab)}
          limit={Math.min(Number(query.n) || 30, 300)}
          basePath={`/perfil/${id}`}
          actions={
            canAskMission ? (
              <form action={requestChosenMission}>
                <input type="hidden" name="targetId" value={id} />
                <button type="submit" className="xp-btn-secondary min-h-11 w-full" style={{ background: "var(--bubble-3)" }}>
                  🎯 Pedir una misión para {displayName(owner)}
                </button>
              </form>
            ) : null
          }
        />
      </div>
    </main>
  );
}
