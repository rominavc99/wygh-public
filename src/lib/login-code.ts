import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

/** Vigencia del código (y del enlace, que lleva el mismo código). */
export const LOGIN_CODE_MAX_AGE_SECONDS = 15 * 60;

/**
 * Intentos fallidos permitidos por correo antes de invalidar todos sus
 * códigos vigentes. Con 6 dígitos, adivinar en 5 intentos es 1 en 200 000,
 * y para volver a probar hay que pedir un correo nuevo (que también tiene
 * su propio límite en login/actions.ts).
 */
const MAX_FAILED_ATTEMPTS = 5;

export function generateLoginCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function normalizeLoginCode(raw: string): string {
  return raw.replace(/\D/g, "");
}

function failedAttemptsKey(email: string): string {
  return `login:code-fail:${email}`;
}

/**
 * Mismo hash con el que Auth.js guarda el token en VerificationToken
 * (@auth/core: createHash(`${token}${secret}`), con el secret del provider
 * fijado en auth.ts).
 */
function hashLoginCode(code: string): string {
  return createHash("sha256").update(`${code}${process.env.AUTH_SECRET}`).digest("hex");
}

/**
 * Revisa el código sin consumirlo (lo consume Auth.js en el callback, que
 * es quien crea la sesión). Cada fallo cuenta; al llegar al límite se
 * borran los códigos vigentes de ese correo.
 */
export async function verifyLoginCode(
  email: string,
  code: string
): Promise<"ok" | "invalid" | "locked"> {
  const failKey = failedAttemptsKey(email);
  const valid =
    /^\d{6}$/.test(code) &&
    (await prisma.verificationToken.findFirst({
      where: { identifier: email, token: hashLoginCode(code), expires: { gt: new Date() } },
      select: { token: true },
    })) !== null;

  if (valid) {
    resetRateLimit(failKey);
    return "ok";
  }

  if (!rateLimit(failKey, MAX_FAILED_ATTEMPTS - 1, LOGIN_CODE_MAX_AGE_SECONDS * 1000)) {
    resetRateLimit(failKey);
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    return "locked";
  }
  return "invalid";
}

/**
 * Tope para el callback de Auth.js (GET /api/auth/callback/nodemailer):
 * ahí también se puede probar un código directo en la URL, saltándose el
 * formulario. Es holgado para quien solo da clic al enlace o escribe el
 * código un par de veces.
 */
export function allowCodeCallback(email: string): boolean {
  return rateLimit(`login:code-callback:${email.trim().toLowerCase()}`, 10, LOGIN_CODE_MAX_AGE_SECONDS * 1000);
}
