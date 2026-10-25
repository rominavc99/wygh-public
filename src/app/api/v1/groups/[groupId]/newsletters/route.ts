import { newsletterArchive } from "@/lib/newsletter-archive";
import { addDaysLocal } from "@/lib/date";
import { handler, json, requireApiUser } from "@/lib/api/http";
import { requireGroupAccess } from "@/lib/api/groups";

/**
 * GET /api/v1/groups/<groupId>/newsletters?archive=day|legacy|all — el
 * archivo del grupo, del más reciente al más viejo. archive=day (default)
 * son los Resúmenes del día; legacy, los de "¿Qué harás al llegar a tu
 * casa?". Las ediciones de cumpleaños traen `birthdayUserId`.
 */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/groups/[groupId]/newsletters">) => {
  const user = await requireApiUser(request);
  const { groupId } = await ctx.params;
  await requireGroupAccess(user, groupId);
  const archive = new URL(request.url).searchParams.get("archive") ?? "day";
  const { entries } = await newsletterArchive(groupId);
  const shown = entries.filter((e) => archive === "all" || e.legacy === (archive === "legacy"));
  return json({
    hasLegacy: entries.some((e) => e.legacy),
    newsletters: shown.map((e) => ({
      date: e.date,
      describedDate: e.legacy ? e.date : addDaysLocal(e.date, -1),
      format: e.legacy ? "HOME" : "DAY",
      type: e.cumple ? "birthday" : "daily",
      birthdayUserId: e.cumple,
      celebrant: e.celebrant,
    })),
  });
});
