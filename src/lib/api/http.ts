import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session-config";
import { rateLimit } from "@/lib/rate-limit";
import { markSeen } from "@/lib/last-seen";
import type { Role } from "@/generated/prisma/enums";

// Base de la API para la app móvil (/api/v1/*, ver docs/API.md): respuestas
// JSON, errores con un formato fijo y autenticación con token Bearer.
//
// El token es una fila normal de Session (la misma tabla que usa Auth.js
// para la web), creada al verificar el código de inicio de sesión: así
// vence igual que una sesión web (SESSION_MAX_AGE_SECONDS) y se puede
// cerrar desde POST /api/v1/auth/logout.

export type ApiUser = { id: string; role: Role; name: string; username: string | null; email: string };

/** Error que se devuelve tal cual al cliente: `{ error: { code, message, fields? } }`. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, "unauthorized", "Falta iniciar sesión o el token ya no es válido.");
export const forbidden = (message = "No tienes permiso para esto.") => new ApiError(403, "forbidden", message);
export const notFound = (message = "No encontramos eso.") => new ApiError(404, "not_found", message);
export const badRequest = (message: string, fields?: Record<string, string>) =>
  new ApiError(400, "invalid_request", message, fields);
export const conflict = (message: string) => new ApiError(409, "conflict", message);

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Envuelve un handler: los ApiError salen como JSON con su status; cualquier
 * otro error se registra y sale como 500 genérico (sin detalles internos).
 */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return json({ error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } }, error.status);
      }
      // UnauthorizedError / ForbiddenError de src/lib/auth-guards.ts (Server Actions reutilizadas).
      const authStatus = (error as { authStatus?: number } | null)?.authStatus;
      if (authStatus === 401) return json({ error: { code: "unauthorized", message: unauthorized().message } }, 401);
      if (authStatus === 403) return json({ error: { code: "forbidden", message: "Solo para admins." } }, 403);
      console.error("[api] Error inesperado:", error);
      return json({ error: { code: "server_error", message: "Algo falló de nuestro lado. Intenta de nuevo." } }, 500);
    }
  };
}

function bearerToken(header: string | null): string | null {
  const match = (header ?? "").match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

function bearer(request: Request): string | null {
  return bearerToken(request.headers.get("authorization"));
}

/** El usuario del token, o null si no hay token válido (sesión vencida, usuario desactivado). */
export async function optionalApiUser(request: Request): Promise<ApiUser | null> {
  return apiUserFromAuthorization(request.headers.get("authorization"));
}

/** Igual que optionalApiUser, a partir del valor del encabezado Authorization. */
export async function apiUserFromAuthorization(header: string | null): Promise<ApiUser | null> {
  const token = bearerToken(header);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    select: { expires: true, user: { select: { id: true, role: true, name: true, username: true, email: true, active: true } } },
  });
  if (!session || session.expires < new Date() || !session.user.active) return null;
  const { id, role, name, username, email } = session.user;
  return { id, role, name, username, email };
}

export async function requireApiUser(request: Request): Promise<ApiUser> {
  const user = await optionalApiUser(request);
  if (!user) throw unauthorized();
  // Usar la app cuenta como entrar al sitio (lastSeenAt): de eso depende,
  // p. ej., salir como opción en las misiones de otros.
  await markSeen(user.id);
  return user;
}

export async function requireApiAdmin(request: Request): Promise<ApiUser> {
  const user = await requireApiUser(request);
  if (user.role !== "ADMIN") throw forbidden("Solo para admins.");
  return user;
}

/** Crea la sesión (token) de la app para `userId`. */
export async function createApiSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.session.create({ data: { sessionToken: token, userId, expires: expiresAt } });
  return { token, expiresAt };
}

export async function deleteApiSession(request: Request): Promise<void> {
  const token = bearer(request);
  if (token) await prisma.session.deleteMany({ where: { sessionToken: token } });
}

/** Lanza 429 si se pasa del límite (mismo limitador en memoria que la web). */
export function limit(key: string, max: number, windowMs: number): void {
  if (!rateLimit(key, max, windowMs)) {
    throw new ApiError(429, "rate_limited", "Demasiados intentos seguidos. Espera un momento e intenta de nuevo.");
  }
}

/** El cuerpo JSON como objeto (400 si no es JSON válido). */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // cae al error de abajo
  }
  throw badRequest("El cuerpo tiene que ser un objeto JSON.");
}

export function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
