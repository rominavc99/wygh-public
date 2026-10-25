import { prisma } from "@/lib/prisma";
import { updateSettings } from "@/app/admin/ajustes/actions";
import { handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf, overlay } from "@/lib/api/admin";

const KEYS = [
  "newsletterName",
  "tagline",
  "autoSend",
  "lockResponsesAfterSend",
  "fromName",
  "fromEmail",
  "weeklySummaryEnabled",
  "weeklySummaryDay",
  "weeklySummaryTime",
  "inactivityNudgeEnabled",
  "inactivityNudgeDays",
  "inactivityNudgeTime",
  "inactivityNudgeSubject",
  "inactivityNudgeTemplate",
  "extrasEmailTime",
  "streakEmailEnabled",
  "onThisDayEnabled",
  "anniversaryEnabled",
  "wrappedEnabled",
  "welcomeEmailEnabled",
  "missedEmailEnabled",
  "missedEmailDelayMinutes",
] as const;

async function current() {
  const s = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const out: Record<(typeof KEYS)[number], unknown> = {} as never;
  for (const k of KEYS) out[k] = s[k];
  return { ...out, extraordinaryResponsesEnabled: s.extraordinaryResponsesEnabled };
}

/** GET /api/v1/admin/settings — ajustes generales (nombre, envío automático, correos especiales…). Los de cada boletín están en el grupo. */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  return json(await current());
});

/** PATCH /api/v1/admin/settings — cambia solo lo que venga (mismas llaves que GET, menos extraordinaryResponsesEnabled). */
export const PATCH = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const merged = overlay(await current(), await readJson(request), KEYS);
  const fields: Record<string, unknown> = {};
  for (const k of KEYS) fields[k] = merged[k];
  checkState(await updateSettings(IDLE, formOf(fields)));
  return json(await current());
});
