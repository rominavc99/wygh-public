import { z } from "zod";

export const communicationSchema = z
  .object({
    subject: z.string().trim().min(1, "Escribe un asunto.").max(200, "Máximo 200 caracteres."),
    audience: z.enum(["all", "selected"]),
    recipientIds: z.array(z.string()).default([]),
    sendMode: z.enum(["now", "later"]),
    scheduledAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audience === "selected" && data.recipientIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["recipientIds"], message: "Selecciona al menos una persona." });
    }
    if (data.sendMode === "later") {
      if (!data.scheduledAt) {
        ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Elige fecha y hora." });
      } else {
        const time = new Date(data.scheduledAt).getTime();
        if (Number.isNaN(time) || time <= Date.now()) {
          ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Debe ser un momento futuro." });
        }
      }
    }
  });
