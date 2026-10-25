import { addExtraordinaryGrant } from "@/app/admin/ajustes/actions";
import { handler, json, readJson, requireApiAdmin } from "@/lib/api/http";
import { IDLE, checkState, formOf } from "@/lib/api/admin";

/** POST /api/v1/admin/extraordinary/grants { userId, date } — da un permiso de un solo uso para responder un día pasado. */
export const POST = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const b = await readJson(request);
  const state = checkState(await addExtraordinaryGrant(IDLE, formOf({ userId: b.userId, date: b.date })));
  return json({ message: state.status === "done" ? state.message : null }, 201);
});
