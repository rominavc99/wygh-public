import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { createPhrase } from "@/app/admin/frases/actions";
import { handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf } from "@/lib/api/admin";

/** GET /api/v1/admin/phrases — catálogo de frases del día (y en qué grupos está fija cada una). */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const [phrases, groups] = await Promise.all([
    prisma.phrase.findMany({ orderBy: { createdAt: "asc" }, include: { author: true } }),
    prisma.group.findMany({ select: { id: true, name: true, selectedPhraseId: true } }),
  ]);
  return json({
    phrases: phrases.map((p) => ({
      id: p.id,
      text: p.text,
      author: p.author ? { id: p.author.id, name: displayName(p.author) } : null,
      date: p.date,
      fixedInGroups: groups.filter((g) => g.selectedPhraseId === p.id).map((g) => ({ id: g.id, name: g.name })),
    })),
  });
});

/** POST /api/v1/admin/phrases { text } — agrega una frase. Para fijarla en un grupo: PATCH /admin/groups/<id> con newsletter.selectedPhraseId. */
export const POST = handler(async (request: Request) => {
  await requireApiAdmin(request);
  checkState(await createPhrase(IDLE, formOf({ text: (await readJson(request)).text })));
  return json({ ok: true }, 201);
});
