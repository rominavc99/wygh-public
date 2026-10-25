import { joinGroupWithToken } from "@/lib/groups";
import { ApiError, badRequest, handler, json, readJson, requireApiUser, str } from "@/lib/api/http";

/**
 * POST /api/v1/groups/join { token } — unirse con el enlace de invitación
 * (el token es la última parte de .../grupos/unirse/<token>).
 * Respuesta: { status: "joined" | "already", groupName }.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  const token = str((await readJson(request)).token).trim().split("/").pop() ?? "";
  if (!token) throw badRequest("Falta el token de invitación.");
  const result = await joinGroupWithToken(user.id, token);
  if (result.status === "invalid") throw new ApiError(404, "invalid_invite", "Ese enlace de invitación ya no sirve.");
  if (result.status === "suspended") throw new ApiError(409, "group_suspended", "Ese grupo está en pausa y no admite gente nueva.");
  return json(result);
});
