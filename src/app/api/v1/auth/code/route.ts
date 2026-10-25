import { z } from "zod";
import { sendLoginCode } from "@/lib/send-login-code";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders, loginEmailRateKey } from "@/lib/rate-limit";
import { ApiError, badRequest, forbidden, handler, json, limit, readJson } from "@/lib/api/http";

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * POST /api/v1/auth/code { email } — manda al correo el código de 6 dígitos
 * para entrar (el mismo correo que en la web). Mismas reglas que el login
 * web: solo correos dados de alta y activos.
 */
export const POST = handler(async (request: Request) => {
  limit(`login:ip:${clientIpFromHeaders(request.headers)}`, 8, 10 * 60 * 1000);
  const parsed = emailSchema.safeParse((await readJson(request)).email);
  if (!parsed.success) throw badRequest("Escribe un correo válido.", { email: "Escribe un correo válido." });
  const email = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, select: { active: true } });
  if (!user) throw forbidden("Ese correo no está registrado en el boletín. Pídele al admin del grupo que te agregue.");
  if (!user.active) throw forbidden("Tu cuenta está desactivada. Si crees que es un error, avísale al admin del grupo.");
  limit(loginEmailRateKey(email), 5, 10 * 60 * 1000);

  if (!(await sendLoginCode(email))) {
    throw new ApiError(502, "email_failed", "No pudimos enviarte el correo con el código. Intenta de nuevo en un momento.");
  }
  return json({ ok: true });
});
