import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { renameGroup, setGroupSuspended, updateGroupNewsletter } from "@/app/admin/grupos/actions";
import { badRequest, handler, json, notFound, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf, overlay } from "@/lib/api/admin";
import { NEWSLETTER_KEYS, groupSettingsDto } from "@/lib/api/admin-groups";

async function load(id: string) {
  const group = await prisma.group.findUnique({
    where: { id },
    include: { members: { include: { user: true }, orderBy: { user: { name: "asc" } } } },
  });
  if (!group) throw notFound("No existe ese grupo.");
  return group;
}

/** GET /api/v1/admin/groups/<id> — ajustes del grupo y sus miembros. */
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/groups/[id]">) => {
  await requireApiAdmin(request);
  const group = await load((await ctx.params).id);
  return json({
    ...groupSettingsDto(group),
    members: group.members.map((m) => ({ id: m.user.id, name: displayName(m.user), email: m.user.email, active: m.user.active, joinedAt: m.joinedAt.toISOString() })),
  });
});

/**
 * PATCH /api/v1/admin/groups/<id> { name?, suspended?, newsletter?: { tagline, greetingTemplate,
 * sendTime, reminderEnabled, heroEnabled, heroTitle, heroParagraph, heroImageUrl, heroLinkUrl,
 * heroLinkText, selectedPhraseId } } — cambia solo lo que venga. Responde el grupo.
 */
export const PATCH = handler(async (request: Request, ctx: RouteContext<"/api/v1/admin/groups/[id]">) => {
  await requireApiAdmin(request);
  const { id } = await ctx.params;
  const group = await load(id);
  const body = await readJson(request);

  if ("name" in body) checkState(await renameGroup(id, IDLE, formOf({ name: body.name })));
  if (typeof body.suspended === "boolean") await setGroupSuspended(formOf({ groupId: id, suspended: String(body.suspended) }));
  if (body.newsletter !== undefined) {
    if (!body.newsletter || typeof body.newsletter !== "object") throw badRequest('"newsletter" tiene que ser un objeto.');
    const current = groupSettingsDto(group).newsletter;
    const merged = overlay({ ...current, selectedPhraseId: current.selectedPhraseId ?? "" }, body.newsletter as Record<string, unknown>, NEWSLETTER_KEYS);
    checkState(await updateGroupNewsletter(id, IDLE, formOf({ ...merged, selectedPhraseId: merged.selectedPhraseId ?? "" })));
  }
  return json(groupSettingsDto(await load(id)));
});
