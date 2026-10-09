import { handlers } from "@/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { allowCodeCallback } from "@/lib/login-code";
import type { NextRequest } from "next/server";

// En GET solo se limita el callback del correo: el token es un código de 6
// dígitos y sin tope se podría adivinar probando URLs directamente.
export async function GET(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith("/callback/nodemailer")) {
    const email = request.nextUrl.searchParams.get("email") ?? "";
    if (!allowCodeCallback(email)) {
      return new Response("Demasiados intentos. Pide un correo nuevo para entrar.", { status: 429 });
    }
  }
  return handlers.GET(request);
}

// POST es la vía que dispara el envío del correo con el enlace mágico (y
// el resto de acciones de auth que mutan estado).
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const allowed = rateLimit(`auth:${ip}`, 8, 10 * 60 * 1000);
  if (!allowed) {
    return new Response("Demasiados intentos. Espera unos minutos e intenta de nuevo.", {
      status: 429,
    });
  }
  return handlers.POST(request);
}
