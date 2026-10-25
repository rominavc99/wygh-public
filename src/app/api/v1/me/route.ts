import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { birthdaySchema, greetingEmojiSchema, usernameSchema } from "@/lib/user-schema";
import { badRequest, conflict, handler, json, readJson, requireApiUser } from "@/lib/api/http";
import { meDto } from "@/lib/api/dto";

/** GET /api/v1/me — la persona del token, sus grupos y contadores (notificaciones sin leer, misiones pendientes). */
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  return json(await meDto(user.id));
});

/**
 * PATCH /api/v1/me — cambia solo lo que venga: username, birthday
 * ("YYYY-MM-DD" o "" para quitar), greetingEmoji ("" = el de siempre),
 * missionOptOut, birthdayPromptDismissed.
 */
export const PATCH = handler(async (request: Request) => {
  const user = await requireApiUser(request);
  const body = await readJson(request);
  const data: Prisma.UserUpdateInput = {};
  const fields: Record<string, string> = {};

  const check = <T>(key: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }) => {
    if (!(key in body)) return undefined;
    const parsed = schema.safeParse(body[key] ?? "");
    if (!parsed.success) {
      fields[key] = parsed.error.issues[0]?.message ?? "Valor inválido.";
      return undefined;
    }
    return { value: parsed.data };
  };
  const username = check("username", usernameSchema);
  const birthday = check("birthday", birthdaySchema);
  const greetingEmoji = check("greetingEmoji", greetingEmojiSchema);
  if (username) data.username = username.value;
  if (birthday) data.birthday = birthday.value;
  if (greetingEmoji) data.greetingEmoji = greetingEmoji.value;
  for (const key of ["missionOptOut", "birthdayPromptDismissed"] as const) {
    if (!(key in body)) continue;
    if (typeof body[key] !== "boolean") fields[key] = "Tiene que ser true o false.";
    else data[key] = body[key];
  }
  if (Object.keys(fields).length) throw badRequest("Revisa los campos marcados.", fields);

  try {
    await prisma.user.update({ where: { id: user.id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("Ya alguien más tiene ese nombre de usuario.");
    }
    throw error;
  }
  return json(await meDto(user.id));
});
