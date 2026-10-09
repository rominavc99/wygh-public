import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { addDaysLocal, localDateOf, oneYearBefore, todayLocalDate } from "@/lib/date";
import { displayName } from "@/lib/display-name";
import { getSiteUrl } from "@/lib/site-url";
import { fillNudgeTemplate, inactivityNudgeEmailHtml } from "@/lib/engagement-email";
import { buildWeeklyReport } from "@/lib/weekly-report";
import { weeklyReportEmailHtml } from "@/lib/weekly-report-email";
import { streakEmail, wrappedEmail } from "@/lib/extras-email";
import { anniversaryParts, buildWrapped, onThisDayParts, welcomeParts } from "@/lib/send-extras";

function html(body: string): Response {
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * Vista previa de los correos de participación y especiales tal como le
 * llegarían al admin que la abre, con datos reales cuando los hay.
 * ?correo=resumen | resumen-admin | inactividad | racha | hace-un-ano |
 * aniversario | anual | bienvenida
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
  const name = displayName(user);
  const siteUrl = getSiteUrl();
  const today = todayLocalDate();
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  switch (request.nextUrl.searchParams.get("correo")) {
    case "inactividad": {
      const days = settings.inactivityNudgeDays;
      return html(
        inactivityNudgeEmailHtml({
          name,
          heading: fillNudgeTemplate(settings.inactivityNudgeSubject, name, days),
          message: fillNudgeTemplate(settings.inactivityNudgeTemplate, name, days),
          formUrl: siteUrl,
        })
      );
    }
    case "racha":
      return html(streakEmail({ name, days: 30, siteUrl }).html);
    case "hace-un-ano": {
      // La respuesta de hace un año si existe; si no, la más reciente, como ejemplo.
      const response =
        (await prisma.response.findUnique({ where: { userId_date: { userId: user.id, date: oneYearBefore(today) } } })) ??
        (await prisma.response.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } }));
      if (!response) return html("<p>Todavía no tienes respuestas para armar la vista previa.</p>");
      return html((await onThisDayParts(response.id)).html);
    }
    case "aniversario": {
      const years = Math.max(1, Number(today.slice(0, 4)) - Number(localDateOf(user.createdAt).slice(0, 4)));
      return html((await anniversaryParts(user.id, years, today)).html);
    }
    case "anual": {
      // El año en curso hasta ayer: así se ve el del 1 de enero con datos de verdad.
      const year = Number(today.slice(0, 4));
      const data = (await buildWrapped(year, addDaysLocal(today, -1))).find((d) => d.userId === user.id);
      if (!data) return html("<p>No hay datos tuyos este año para armar la vista previa.</p>");
      return html(wrappedEmail(data, siteUrl).html);
    }
    case "bienvenida":
      return html((await welcomeParts(name)).html);
    default: {
      const report = await buildWeeklyReport(addDaysLocal(today, -1));
      const isAdmin = request.nextUrl.searchParams.get("correo") === "resumen-admin";
      return html(weeklyReportEmailHtml({ name, userId: user.id, report, siteUrl, isAdmin }));
    }
  }
}
