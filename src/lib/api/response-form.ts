import { badRequest } from "@/lib/api/http";

// El resumen del día en JSON (ver PUT /api/v1/today/response en docs/API.md)
// convertido al FormData que validan writeResponse y prepareMissionDeliveries,
// para que la app y la web pasen por exactamente las mismas reglas.

function setText(form: FormData, name: string, value: unknown) {
  if (typeof value === "string") form.set(name, value);
  else if (value !== undefined && value !== null) throw badRequest(`"${name}" tiene que ser texto.`);
}

/** Una foto en JSON: { data: <base64 sin "data:...">, type: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }. */
function setPhoto(form: FormData, prefix: string, photo: unknown) {
  if (photo === undefined || photo === null) return;
  const p = photo as { data?: unknown; type?: unknown };
  if (typeof p !== "object" || typeof p.data !== "string" || typeof p.type !== "string") {
    throw badRequest(`"${prefix || "photo"}" tiene que ser { data, type }.`);
  }
  form.set(`${prefix}photoData`, p.data);
  form.set(`${prefix}photoType`, p.type);
}

/**
 * Devuelve el FormData y los ids de misiones que venían en el cuerpo. Sin
 * `groupIds`, va a `defaultGroupIds` (como en la web, donde vienen todos
 * marcados); quien guarda solo deja los que se pueden elegir.
 */
export function responseFormFromJson(
  body: Record<string, unknown>,
  defaultGroupIds: string[]
): { form: FormData; missionIds: Set<string> } {
  const form = new FormData();
  for (const name of ["didToday", "wentWhere", "food", "bestPart", "worstPart", "tomorrowPlan", "note", "mood", "photoDescription", "phrase", "date"]) {
    setText(form, name, body[name]);
  }
  if (typeof body.stayedHome === "boolean") form.set("stayedHome", body.stayedHome ? "si" : "no");
  setPhoto(form, "", body.photo);
  if (body.removePhoto === true) form.set("removePhoto", "on");
  const groupIds = Array.isArray(body.groupIds) ? body.groupIds.filter((id): id is string => typeof id === "string") : defaultGroupIds;
  for (const id of groupIds) form.append("groupIds", id);

  const missionIds = new Set<string>();
  if (Array.isArray(body.missions)) {
    for (const m of body.missions as { id?: unknown; text?: unknown; photo?: unknown; removePhoto?: unknown }[]) {
      if (!m || typeof m.id !== "string") throw badRequest("Cada misión necesita su id.");
      missionIds.add(m.id);
      setText(form, `mission:${m.id}:text`, m.text ?? "");
      setPhoto(form, `mission:${m.id}:`, m.photo);
      if (m.removePhoto === true) form.set(`mission:${m.id}:removePhoto`, "on");
    }
  }
  return { form, missionIds };
}
