import { deleteApiSession, handler, json } from "@/lib/api/http";

/** POST /api/v1/auth/logout — invalida el token con el que se llama. */
export const POST = handler(async (request: Request) => {
  await deleteApiSession(request);
  return json({ ok: true });
});
