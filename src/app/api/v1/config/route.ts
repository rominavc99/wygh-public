import { prisma } from "@/lib/prisma";
import { ASCII_PICKER, EMOJI_CATEGORIES, QUICK_EMOJIS } from "@/lib/emoji-data";
import {
  BAN_DAYS,
  CANCELS_PER_WEEK,
  CHOSEN_SEEN_DAYS,
  MISSIONS_PER_DAY,
  RANDOM_SEEN_DAYS,
  REJECTIONS_PER_DAY,
  STRIKES_TO_BAN,
  SWAPS_PER_OFFER,
} from "@/lib/missions";
import { REMINDER_OFFSETS } from "@/lib/send-reminder";
import { handler, json } from "@/lib/api/http";

/**
 * GET /api/v1/config — datos fijos para la app (no pide sesión): nombre y
 * lema del sitio, listas de emojis y emoticones, y límites de misiones.
 */
export const GET = handler(async () => {
  const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { newsletterName: true, tagline: true } });
  return json({
    apiVersion: 1,
    siteName: settings?.newsletterName ?? "De regreso a casa",
    tagline: settings?.tagline ?? "",
    emojis: { quick: QUICK_EMOJIS, categories: EMOJI_CATEGORIES, ascii: ASCII_PICKER },
    missions: {
      perDay: MISSIONS_PER_DAY,
      rejectionsPerDay: REJECTIONS_PER_DAY,
      swapsPerOffer: SWAPS_PER_OFFER,
      cancelsPerWeek: CANCELS_PER_WEEK,
      strikesToBan: STRIKES_TO_BAN,
      banDays: BAN_DAYS,
      randomSeenDays: RANDOM_SEEN_DAYS,
      chosenSeenDays: CHOSEN_SEEN_DAYS,
    },
    reminderMinutesBefore: REMINDER_OFFSETS,
  });
});
