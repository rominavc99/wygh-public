"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, loginEmailRateKey, clientIpFromHeaders } from "@/lib/rate-limit";
import { normalizeLoginCode, verifyLoginCode } from "@/lib/login-code";

const emailSchema = z.string().trim().toLowerCase().email();

export type RequestMagicLinkState = { error?: string } | undefined;

export async function requestMagicLink(
  _prevState: RequestMagicLinkState,
  formData: FormData
): Promise<RequestMagicLinkState> {
  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);

  if (!rateLimit(`login:ip:${ip}`, 8, 10 * 60 * 1000)) {
    return { error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." };
  }

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Escribe un correo válido." };
  }
  const email = parsed.data;

  // No hay auto-registro: solo entra quien el admin dio de alta (y está
  // activo). Antes esto se dejaba a callbacks.signIn en auth.ts, pero ahí
  // el rechazo truena como AccessDenied y la persona veía la pantalla
  // genérica de "Algo tronó… intenta de nuevo" — y reintentaba hasta
  // bloquearse. Se revisa aquí primero para decirle qué pasa, y sin gastar
  // el límite por correo (para no amanecer bloqueada en cuanto el admin la
  // registre). callbacks.signIn sigue siendo la barrera real.
  const user = await prisma.user.findUnique({ where: { email }, select: { active: true } });
  if (!user?.active) {
    return {
      error: user
        ? "Tu cuenta está desactivada. Si crees que es un error, avísale al admin del grupo."
        : "Ese correo no está registrado en el boletín. Pídele al admin del grupo que te agregue (o revisa que esté bien escrito).",
    };
  }

  if (!rateLimit(loginEmailRateKey(email), 5, 10 * 60 * 1000)) {
    return { error: "Demasiados intentos para este correo. Espera unos minutos." };
  }

  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  // Sin el redirect propio de signIn (que iría a la pantalla genérica de
  // "revisa tu correo"): la pantalla de verificar necesita el correo para
  // poder escribir ahí el código. Solo se atrapan los errores propios de
  // Auth.js (p. ej. si no se pudo mandar el correo).
  try {
    await signIn("nodemailer", { email, redirectTo: callbackUrl, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("[login] No se pudo mandar el enlace mágico:", error);
      return { error: "No pudimos enviarte el enlace. Intenta de nuevo en un momento o avísale al admin del grupo." };
    }
    throw error;
  }
  redirect(`/login/verificar?${new URLSearchParams({ email, callbackUrl })}`);
}

export type VerifyCodeState = { error?: string; redirectTo?: string } | undefined;

export async function verifyCode(
  _prevState: VerifyCodeState,
  formData: FormData
): Promise<VerifyCodeState> {
  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);

  if (!rateLimit(`login:code:ip:${ip}`, 20, 10 * 60 * 1000)) {
    return { error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." };
  }

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Falta el correo. Vuelve a pedir el código desde el inicio." };
  }
  const email = parsed.data;
  const code = normalizeLoginCode(String(formData.get("code") ?? ""));
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  const result = await verifyLoginCode(email, code);
  if (result === "locked") {
    return { error: "Demasiados códigos incorrectos. Pide un correo nuevo para entrar." };
  }
  if (result === "invalid") {
    return { error: "Ese código no es válido o ya expiró. Revisa que sea el del correo más reciente." };
  }

  // El código es bueno: lo consume el callback normal de Auth.js, que es
  // quien crea la sesión (y valida que callbackUrl sea de este sitio). Se
  // navega desde el cliente con una carga completa para que la cookie de
  // sesión quede en este mismo navegador.
  return {
    redirectTo: `/api/auth/callback/nodemailer?${new URLSearchParams({ callbackUrl, token: code, email })}`,
  };
}
