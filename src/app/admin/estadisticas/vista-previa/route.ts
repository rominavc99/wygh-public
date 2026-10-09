import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { addDaysLocal, todayLocalDate } from "@/lib/date";
import { getSiteUrl } from "@/lib/site-url";
import { buildWeeklySummary } from "@/lib/send-engagement";
import { fillNudgeTemplate, inactivityNudgeEmailHtml, weeklySummaryEmailHtml } from "@/lib/engagement-email";

/**
 * Vista previa de los correos de participación tal como le llegarían al
 * admin que la abre: ?correo=resumen (con los datos de los últimos 7 días)
 * o ?correo=inactividad (con el número de días configurado).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
  const name = user.username?.trim() || user.name;
  const siteUrl = getSiteUrl();

  let html: string;
  if (request.nextUrl.searchParams.get("correo") === "inactividad") {
    const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    const days = settings.inactivityNudgeDays;
    html = inactivityNudgeEmailHtml({
      name,
      heading: fillNudgeTemplate(settings.inactivityNudgeSubject, name, days),
      message: fillNudgeTemplate(settings.inactivityNudgeTemplate, name, days),
      formUrl: siteUrl,
    });
  } else {
    const content = await buildWeeklySummary(addDaysLocal(todayLocalDate(), -1));
    html = weeklySummaryEmailHtml({ name, userId: user.id, content, siteUrl });
  }

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
