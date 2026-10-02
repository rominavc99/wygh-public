import { z } from "zod";

export const responseSchema = z
  .object({
    atHome: z.boolean(),
    arrivingLate: z.boolean(),
    beforeHomePlan: z.string().trim().max(2000).nullable(),
    stayedHome: z.boolean(),
    homePlan: z.string().trim().max(2000).nullable(),
    awayPlan: z.string().trim().max(2000).nullable(),
    tonightPlan: z.string().trim().max(2000).nullable(),
    food: z.string().trim().min(1, "Cuéntanos qué vas a comer.").max(1000),
    goingOut: z.boolean(),
    goingOutWhere: z.string().trim().max(500).nullable(),
    note: z.string().trim().max(2000).nullable(),
    photoFilename: z.string().trim().max(300).nullable(),
    photoDescription: z.string().trim().max(300).nullable(),
    phraseText: z.string().trim().max(300).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.atHome && !data.homePlan) {
      ctx.addIssue({
        code: "custom",
        path: ["homePlan"],
        message: data.stayedHome
          ? "Cuéntanos qué hiciste hoy en tu casa."
          : "Cuéntanos qué vas a hacer cuando llegues a tu casa.",
      });
    }
    if (data.arrivingLate && !data.beforeHomePlan) {
      ctx.addIssue({
        code: "custom",
        path: ["beforeHomePlan"],
        message: "Cuéntanos qué harás antes de llegar a tu casa.",
      });
    }
    if (!data.atHome && !data.awayPlan) {
      ctx.addIssue({
        code: "custom",
        path: ["awayPlan"],
        message: "Cuéntanos para dónde vas y a qué.",
      });
    }
    if (data.stayedHome && !data.tonightPlan) {
      ctx.addIssue({
        code: "custom",
        path: ["tonightPlan"],
        message: "Cuéntanos qué harás en la noche.",
      });
    }
    if (data.goingOut && !data.goingOutWhere) {
      ctx.addIssue({
        code: "custom",
        path: ["goingOutWhere"],
        message: "Cuéntanos a dónde vas a salir.",
      });
    }
    if (data.photoFilename && !data.photoDescription) {
      ctx.addIssue({
        code: "custom",
        path: ["photoDescription"],
        message: "Agrega una descripción para tu foto.",
      });
    }
  });

export type ResponseInput = z.infer<typeof responseSchema>;

export type HomeStatus = "onTime" | "later" | "away" | "stayed";

/**
 * `photo` trae el filename ya resuelto (guardado en disco o conservado de
 * la respuesta existente) — la lectura/validación del archivo en sí pasa
 * antes, en la Server Action, porque es async I/O y no pertenece a un
 * parseo síncrono de FormData.
 */
export function parseResponseFormData(formData: FormData, photo: { filename: string | null }) {
  const homeStatus = formData.get("homeStatus") as HomeStatus | null;
  const atHome = homeStatus !== "away";
  const stayedHome = homeStatus === "stayed";
  const arrivingLate = homeStatus === "later";
  // goingOut solo se pregunta (y solo se confía) cuando se llega a la hora
  // normal — en los demás flujos ni siquiera se muestra el campo en el
  // formulario, así que se ignora cualquier valor que llegara de todos modos.
  const isOnTime = atHome && !stayedHome && !arrivingLate;
  const goingOut = isOnTime && formData.get("goingOut") === "si";
  const photoFilename = photo.filename;

  return responseSchema.safeParse({
    atHome,
    arrivingLate,
    beforeHomePlan: arrivingLate ? ((formData.get("beforeHomePlan") as string) || null) : null,
    stayedHome,
    homePlan: atHome ? ((formData.get("homePlan") as string) || null) : null,
    awayPlan: !atHome ? ((formData.get("awayPlan") as string) || null) : null,
    tonightPlan: stayedHome ? ((formData.get("tonightPlan") as string) || null) : null,
    food: (formData.get("food") as string) || "",
    goingOut,
    goingOutWhere: goingOut ? ((formData.get("goingOutWhere") as string) || null) : null,
    note: (formData.get("note") as string) || null,
    photoFilename,
    photoDescription: photoFilename ? ((formData.get("photoDescription") as string) || null) : null,
    phraseText: (formData.get("phrase") as string) || null,
  });
}
