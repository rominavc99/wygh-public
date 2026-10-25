import { prisma } from "@/lib/prisma";
import { PUSH_PROVIDERS, type PushProvider } from "@/lib/push";
import { badRequest, handler, json, readJson, requireApiUser, str } from "@/lib/api/http";

/**
 * POST /api/v1/me/devices { token, provider: "expo" | "fcm", platform: "ios" | "android" }
 * — registra el teléfono para recibir push (llamarlo al iniciar sesión y
 * cada vez que el sistema dé un token nuevo). Un mismo token solo queda
 * ligado a la última persona que lo registró.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  const body = await readJson(request);
  const token = str(body.token).trim();
  const provider = str(body.provider);
  const platform = str(body.platform);
  if (!token || token.length > 4096) throw badRequest('Falta "token".');
  if (!PUSH_PROVIDERS.includes(provider as PushProvider)) throw badRequest('"provider" tiene que ser "expo" o "fcm".');
  if (platform !== "ios" && platform !== "android") throw badRequest('"platform" tiene que ser "ios" o "android".');
  await prisma.pushDevice.upsert({
    where: { token },
    create: { token, provider, platform, userId: user.id },
    update: { provider, platform, userId: user.id, lastSeenAt: new Date() },
  });
  return json({ ok: true }, 201);
});

/** DELETE /api/v1/me/devices { token } — deja de mandarle push a ese teléfono (p. ej. al cerrar sesión). */
export const DELETE = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  const token = str((await readJson(request)).token).trim();
  if (!token) throw badRequest('Falta "token".');
  await prisma.pushDevice.deleteMany({ where: { token, userId: user.id } });
  return json({ ok: true });
});
