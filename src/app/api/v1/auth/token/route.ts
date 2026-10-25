import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders } from "@/lib/rate-limit";
import { consumeLoginCode, normalizeLoginCode } from "@/lib/login-code";
import { ApiError, badRequest, createApiSession, handler, json, limit, readJson, str } from "@/lib/api/http";
import { meDto } from "@/lib/api/dto";

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * POST /api/v1/auth/token { email, code } — cambia el código del correo por
 * un token. Respuesta: { token, expiresAt, user }. El token va en cada
 * petición como "Authorization: Bearer <token>".
 */
export const POST = handler(async (request: Request) => {
  limit(`login:code:ip:${clientIpFromHeaders(request.headers)}`, 20, 10 * 60 * 1000);
  const body = await readJson(request);
  const parsed = emailSchema.safeParse(body.email);
  if (!parsed.success) throw badRequest("Falta el correo.", { email: "Escribe un correo válido." });
  const email = parsed.data;
  const code = normalizeLoginCode(str(body.code));

  const result = await consumeLoginCode(email, code);
  if (result === "locked") throw new ApiError(429, "code_locked", "Demasiados códigos incorrectos. Pide un código nuevo.");
  if (result === "invalid") throw new ApiError(401, "invalid_code", "Ese código no es válido o ya expiró.", { code: "Código incorrecto o vencido." });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.active) throw new ApiError(403, "forbidden", "Tu cuenta no tiene acceso al boletín.");
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });

  const session = await createApiSession(user.id);
  return json({ token: session.token, expiresAt: session.expiresAt.toISOString(), user: await meDto(user.id) });
});
