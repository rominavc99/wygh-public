import { prisma } from "@/lib/prisma";
import { todayLocalDate } from "@/lib/date";
import { writeResponse, type SaveResponseState } from "@/lib/save-response";
import { activeGroupIdsOf } from "@/lib/groups";
import { notifyExtraordinaryResponse } from "@/lib/extraordinary";

/**
 * Guarda una respuesta extraordinaria (día pasado, campo "date" del
 * formulario) con las reglas de src/lib/extraordinary.ts. La comparten la
 * Server Action de /respuesta-extraordinaria y la API; la sesión y el
 * límite de intentos los revisa cada uno.
 */
export async function submitExtraordinaryResponse(
  user: { id: string; role: string },
  formData: FormData
): Promise<SaveResponseState> {
  const userId = user.id;
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: "error", fieldErrors: { date: "Elige el día de tu respuesta." }, message: "Revisa los campos marcados." };
  }

  const [settings, grant, existing] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.extraordinaryGrant.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.response.findUnique({ where: { userId_date: { userId, date } } }),
  ]);

  const isAdmin = user.role === "ADMIN";
  if (date >= todayLocalDate()) {
    return isAdmin
      ? { status: "error", fieldErrors: { date: "Elige un día que ya haya pasado." }, message: "Revisa los campos marcados." }
      : { status: "error", message: "No tienes un privilegio activo para ese día." };
  }
  if (!isAdmin && (!settings.extraordinaryResponsesEnabled || !grant)) {
    return { status: "error", message: "No tienes un privilegio activo para ese día." };
  }
  if (grant?.usedAt) {
    return { status: "error", message: "Ya usaste tu privilegio para ese día." };
  }
  if (existing) {
    return { status: "error", message: "Ya tienes una respuesta para ese día." };
  }
  // Ese día ya pasó (sus boletines ya salieron, o no salieron porque la app
  // falló), así que se puede mandar a cualquiera de sus grupos.
  const groupIds = await activeGroupIdsOf(userId);
  if (groupIds.length === 0) {
    return { status: "error", message: "Todavía no estás en ningún grupo, así que no hay a dónde mandar tu respuesta." };
  }

  // Se aparta el permiso antes de guardar, para que dos envíos seguidos no
  // lo usen dos veces; si la respuesta no se guarda, se suelta. Al admin
  // sin permiso se le crea uno ya usado (único por persona y día, así que
  // un segundo envío simultáneo choca ahí).
  let release: () => Promise<unknown>;
  if (grant) {
    const { count } = await prisma.extraordinaryGrant.updateMany({
      where: { id: grant.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) return { status: "error", message: "Ya usaste tu privilegio para ese día." };
    release = () => prisma.extraordinaryGrant.update({ where: { id: grant.id }, data: { usedAt: null } });
  } else {
    let createdId: string;
    try {
      const created = await prisma.extraordinaryGrant.create({
        data: { userId, date, grantedById: userId, notifiedAt: new Date(), usedAt: new Date() },
      });
      createdId = created.id;
    } catch {
      return { status: "error", message: "Ya tienes una respuesta para ese día." };
    }
    release = () => prisma.extraordinaryGrant.delete({ where: { id: createdId } });
  }

  let result: SaveResponseState;
  try {
    result = await writeResponse(userId, date, formData, null, groupIds);
  } catch (error) {
    await release();
    throw error;
  }
  if (result.status !== "success") {
    await release();
    return result;
  }

  void notifyExtraordinaryResponse(userId, date);
  return result;
}
