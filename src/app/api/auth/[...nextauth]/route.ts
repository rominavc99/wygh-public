import { handlers } from "@/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const { GET } = handlers;

// Solo se limita POST: es la vía que dispara el envío del correo con el
// enlace mágico (y el resto de acciones de auth que mutan estado).
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
