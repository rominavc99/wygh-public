import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markSeen } from "@/lib/last-seen";
import { profileTab } from "@/lib/profile";
import { ProfileView } from "./profile-view";

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ tab?: string; n?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await markSeen(session.user.id);
  const params = await searchParams;

  return (
    <main className="relative z-10 flex flex-1 justify-center px-4 py-8 sm:py-10">
      <div className="flex w-full max-w-2xl flex-col gap-5">
        <ProfileView
          ownerId={session.user.id}
          viewer={session.user}
          tab={profileTab(params.tab)}
          limit={Math.min(Number(params.n) || 30, 300)}
          basePath="/perfil"
          actions={
            <Link href="/perfil/ajustes" className="xp-btn-secondary flex min-h-11 items-center justify-center no-underline">
              ⚙️ Ajustes de mi perfil
            </Link>
          }
        />
      </div>
    </main>
  );
}
