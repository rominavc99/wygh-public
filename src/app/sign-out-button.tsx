import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button type="submit" className="whitespace-nowrap hover:text-chrome-4">
        🚪 Cerrar sesión
      </button>
    </form>
  );
}
