import { prisma } from "@/lib/prisma";
import { updateBirthdaySettings } from "@/app/admin/cumpleanos/actions";
import { handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf, overlay } from "@/lib/api/admin";
import { BIRTHDAY_KEYS, birthdaySettingsDto } from "@/lib/api/admin-birthdays";

/**
 * PATCH /api/v1/admin/birthdays/settings { birthdayEnabled?, birthdaySendTime?, birthdayGreetingTemplate?,
 * birthdayHeroTitle?, birthdayHeroParagraph?, birthdayTopTitle? } — cambia solo lo que venga.
 */
export const PATCH = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const merged = overlay(birthdaySettingsDto(settings), await readJson(request), BIRTHDAY_KEYS);
  checkState(await updateBirthdaySettings(IDLE, formOf(merged)));
  return json(birthdaySettingsDto(await prisma.settings.findUniqueOrThrow({ where: { id: 1 } })));
});
