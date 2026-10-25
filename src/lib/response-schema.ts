import { z } from "zod";

// Formulario "Resumen del día" (Response.format = DAY). Las respuestas del
// formato anterior (HOME) ya no se crean ni se editan; solo se consultan.

export const responseSchema = z
  .object({
    didToday: z.string().trim().min(1, "Cuéntanos qué hiciste.").max(2000),
    atHome: z.boolean({ error: "Dinos si te quedaste en tu casa." }),
    wentWhere: z.string().trim().max(500).nullable(),
    // "¿Qué comiste?" — opcional; vacío se guarda como "".
    food: z.string().trim().max(1000),
    bestPart: z.string().trim().max(1000).nullable(),
    worstPart: z.string().trim().max(1000).nullable(),
    tomorrowPlan: z.string().trim().max(1000).nullable(),
    note: z.string().trim().max(2000).nullable(),
    mood: z.string().trim().min(1, "Ponle un estado a tu día.").max(120),
    photoFilename: z.string().trim().max(300).nullable(),
    photoDescription: z.string().trim().max(300).nullable(),
    phraseText: z.string().trim().max(300).nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.atHome && !data.wentWhere) {
      ctx.addIssue({ code: "custom", path: ["wentWhere"], message: "Cuéntanos a dónde fuiste." });
    }
    if (data.photoFilename && !data.photoDescription) {
      ctx.addIssue({ code: "custom", path: ["photoDescription"], message: "Agrega una descripción para tu foto." });
    }
  });

export type ResponseInput = z.infer<typeof responseSchema>;

/** Los campos que solo usaba el formato HOME, vacíos para un resumen del día. */
export const DAY_FORMAT_DEFAULTS = {
  format: "DAY",
  arrivingLate: false,
  beforeHomePlan: null,
  stayedHome: false,
  homePlan: null,
  awayPlan: null,
  tonightPlan: null,
  goingOut: false,
  goingOutWhere: null,
} as const;

function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * `photo` trae el filename ya resuelto (guardado en disco o conservado de
 * la respuesta existente) — la lectura/validación del archivo en sí pasa
 * antes, en la Server Action, porque es async I/O y no pertenece a un
 * parseo síncrono de FormData.
 */
export function parseResponseFormData(formData: FormData, photo: { filename: string | null }) {
  const stayed = formData.get("stayedHome");
  const atHome = stayed === "si" ? true : stayed === "no" ? false : undefined;
  const photoFilename = photo.filename;

  return responseSchema.safeParse({
    didToday: text(formData, "didToday") ?? "",
    atHome,
    // Solo se confía en "¿A dónde fuiste?" si dijo que no se quedó en casa.
    wentWhere: atHome === false ? text(formData, "wentWhere") : null,
    food: text(formData, "food") ?? "",
    bestPart: text(formData, "bestPart"),
    worstPart: text(formData, "worstPart"),
    tomorrowPlan: text(formData, "tomorrowPlan"),
    note: text(formData, "note"),
    mood: text(formData, "mood") ?? "",
    photoFilename,
    photoDescription: photoFilename ? text(formData, "photoDescription") : null,
    phraseText: text(formData, "phrase"),
  });
}
