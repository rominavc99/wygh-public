import { AuthError } from "next-auth";
import { signIn } from "@/auth";

/**
 * Pide a Auth.js que mande el correo con el código para entrar. Devuelve
 * false si no salió. Ojo: con redirect: false, Auth.js no lanza cuando falla
 * el envío — devuelve la URL de su página de error (pages.error, con
 * ?error=...) — así que hay que revisar también esa URL. La usan el login
 * web y POST /api/v1/auth/code.
 */
export async function sendLoginCode(email: string, redirectTo = "/"): Promise<boolean> {
  try {
    const url = await signIn("nodemailer", { email, redirectTo, redirect: false });
    if (typeof url === "string" && new URL(url, "http://local").searchParams.has("error")) {
      console.error(`[login] Auth.js no pudo mandar el código a ${email}: ${url}`);
      return false;
    }
    return true;
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("[login] No se pudo mandar el código:", error);
      return false;
    }
    throw error;
  }
}
