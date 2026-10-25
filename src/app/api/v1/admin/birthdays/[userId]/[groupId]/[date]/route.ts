import { personalizeGreeting } from "@/lib/newsletter";
import { getBirthdayNewsletterPreview } from "@/lib/birthday-newsletter";
import { handler, json, requireApiAdmin } from "@/lib/api/http";
import { checkDate } from "@/lib/api/admin";

/** GET /api/v1/admin/birthdays/<userId>/<groupId>/<date> — vista previa de la edición de cumpleaños (la enviada tal cual, o cómo saldría). */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/birthdays/[userId]/[groupId]/[date]">) => {
  const admin = await requireApiAdmin(request);
  const { userId, groupId, date } = await ctx.params;
  checkDate(date);
  const preview = await getBirthdayNewsletterPreview(userId, groupId, date);
  const { html, text } = personalizeGreeting(preview, admin.name, preview.greetingTemplate);
  return json({
    userId,
    groupId,
    date,
    sent: preview.sent,
    sentAt: preview.sentAt?.toISOString() ?? null,
    status: preview.status ?? null,
    error: preview.error ?? null,
    momentCount: preview.momentCount,
    recipientCount: preview.recipientCount,
    html,
    text,
  });
});
