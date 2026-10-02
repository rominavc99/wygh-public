import { z } from "zod";

// Vacío = sin apodo (se usa `name`). Se recorta y normaliza a null si queda vacío.
export const usernameSchema = z
  .string()
  .trim()
  .max(40, "Máximo 40 caracteres.")
  .transform((v) => (v === "" ? null : v));

export const userSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido."),
  role: z.enum(["MEMBER", "ADMIN"]),
  username: usernameSchema,
});

// Fecha de nacimiento del <input type="date"> ("YYYY-MM-DD"). Vacío = sin
// fecha. Tiene que ser una fecha real (nada de 31 de febrero) y no futura.
export const birthdaySchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida.")
  .refine((v) => {
    if (v === "") return true;
    const [y, m, d] = v.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }, "Fecha inválida.")
  .refine((v) => v === "" || (v >= "1900-01-01" && new Date(`${v}T00:00:00`) <= new Date()), "Revisa el año.")
  .transform((v) => (v === "" ? null : v));
