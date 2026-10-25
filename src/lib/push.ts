import crypto from "node:crypto";
import fs from "node:fs";
import { prisma } from "@/lib/prisma";

// Notificaciones push a la app móvil. Cada Notification que se guarda (ver
// recordNotification en src/lib/notifications.ts) también sale como push a
// los teléfonos registrados de esa persona (PushDevice, ver
// POST /api/v1/me/devices). Dos proveedores:
//
// - "expo": Expo Push (apps hechas con Expo / React Native). No pide nada;
//   EXPO_ACCESS_TOKEN es opcional (si el proyecto de Expo lo exige).
// - "fcm": Firebase Cloud Messaging HTTP v1 (Android o iOS nativos). Solo
//   funciona si FCM_SERVICE_ACCOUNT_FILE apunta al JSON de la cuenta de
//   servicio de Firebase (fuera del repo); sin eso, esos dispositivos se
//   ignoran.
//
// Todo es best-effort: un push que falla nunca tumba lo que lo disparó. Los
// tokens que el proveedor reporta como inválidos se borran.

export const PUSH_PROVIDERS = ["expo", "fcm"] as const;
export type PushProvider = (typeof PUSH_PROVIDERS)[number];

export type PushMessage = {
  title: string;
  body: string;
  /** Datos para la app (valores de texto): notificationId, target (JSON). */
  data: Record<string, string>;
  /** Número del ícono (notificaciones sin leer). */
  badge?: number;
};

// EXPO_PUSH_URL solo para pruebas o un proxy propio; por default, el de Expo.
const EXPO_URL = process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send";

async function sendExpo(tokens: string[], message: PushMessage): Promise<string[]> {
  const invalid: string[] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const response = await fetch(EXPO_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(
        batch.map((to) => ({ to, title: message.title, body: message.body, data: message.data, badge: message.badge, sound: "default" }))
      ),
    });
    if (!response.ok) {
      console.error(`[push] Expo respondió ${response.status}: ${await response.text()}`);
      continue;
    }
    const result = (await response.json()) as { data?: { status: string; details?: { error?: string } }[] };
    result.data?.forEach((ticket, index) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") invalid.push(batch[index]);
    });
  }
  return invalid;
}

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri: string };
let fcmAccount: ServiceAccount | null | undefined;
let fcmToken: { value: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (fcmAccount !== undefined) return fcmAccount;
  const file = process.env.FCM_SERVICE_ACCOUNT_FILE;
  try {
    fcmAccount = file ? (JSON.parse(fs.readFileSync(file, "utf8")) as ServiceAccount) : null;
  } catch (error) {
    console.error("[push] No se pudo leer FCM_SERVICE_ACCOUNT_FILE:", error);
    fcmAccount = null;
  }
  return fcmAccount;
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** Token OAuth de Google para FCM (JWT firmado con la cuenta de servicio), con caché. */
async function fcmAccessToken(account: ServiceAccount): Promise<string> {
  if (fcmToken && fcmToken.expiresAt > Date.now() + 60_000) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: account.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
  const response = await fetch(account.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${base64url(signature)}`,
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth respondió ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as { access_token: string; expires_in: number };
  fcmToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return fcmToken.value;
}

async function sendFcm(tokens: string[], message: PushMessage): Promise<string[]> {
  const account = serviceAccount();
  if (!account) return [];
  const accessToken = await fcmAccessToken(account);
  const invalid: string[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: message.title, body: message.body },
            data: message.data,
            apns: message.badge === undefined ? undefined : { payload: { aps: { badge: message.badge, sound: "default" } } },
          },
        }),
      });
      if (response.ok) return;
      const text = await response.text();
      if (response.status === 404 || text.includes("UNREGISTERED")) invalid.push(token);
      else console.error(`[push] FCM respondió ${response.status}: ${text}`);
    })
  );
  return invalid;
}

/** Manda `message` a todos los teléfonos registrados de `userId`. Nunca lanza. */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<void> {
  try {
    const devices = await prisma.pushDevice.findMany({ where: { userId }, select: { token: true, provider: true } });
    if (devices.length === 0) return;
    const byProvider = (p: string) => devices.filter((d) => d.provider === p).map((d) => d.token);
    const [expoInvalid, fcmInvalid] = await Promise.all([
      byProvider("expo").length ? sendExpo(byProvider("expo"), message) : [],
      byProvider("fcm").length ? sendFcm(byProvider("fcm"), message) : [],
    ]);
    const invalid = [...expoInvalid, ...fcmInvalid];
    if (invalid.length) await prisma.pushDevice.deleteMany({ where: { token: { in: invalid } } });
  } catch (error) {
    console.error("[push] No se pudo mandar el push:", error);
  }
}
