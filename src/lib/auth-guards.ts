import { headers } from "next/headers";
import { auth } from "@/auth";
import { apiUserFromAuthorization } from "@/lib/api/http";

// `authStatus` lo lee la API (handler en src/lib/api/http.ts) para responder
// 401/403 cuando una Server Action reutilizada rechaza la sesión.
export class UnauthorizedError extends Error {
  readonly authStatus = 401;
  constructor(message = "No autenticado") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  readonly authStatus = 403;
  constructor(message = "No autorizado") {
    super(message);
  }
}

/**
 * Usar al inicio de cualquier Server Action o route handler que requiera
 * sesión. Acepta la sesión web (cookie) o el token de la app
 * (Authorization: Bearer, ver src/lib/api/http.ts): así los endpoints de
 * /api/v1/admin reutilizan las mismas Server Actions del panel.
 */
export async function requireUser() {
  const session = await auth();
  if (session?.user) return session.user;
  const apiUser = await apiUserFromAuthorization((await headers()).get("authorization"));
  if (!apiUser) throw new UnauthorizedError();
  return apiUser;
}

/** Usar al inicio de cualquier Server Action o route handler exclusivo de admin. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError();
  return user;
}
