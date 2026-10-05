"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { usernameSchema, birthdaySchema, greetingEmojiSchema } from "@/lib/user-schema";

export type ProfileField = "username" | "birthday" | "greetingEmoji";

export type ProfileFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; errors: Partial<Record<ProfileField, string>> };

/** Guarda de una vez todo lo editable de /perfil: nombre de usuario, cumpleaños y emoji del saludo. */
export async function updateMyProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const user = await requireUser();

  const username = usernameSchema.safeParse(formData.get("username") ?? "");
  const birthday = birthdaySchema.safeParse(formData.get("birthday") ?? "");
  const greetingEmoji = greetingEmojiSchema.safeParse(formData.get("greetingEmoji") ?? "");

  const errors: Partial<Record<ProfileField, string>> = {};
  if (!username.success) errors.username = username.error.issues[0]?.message ?? "Usuario inválido.";
  if (!birthday.success) errors.birthday = birthday.error.issues[0]?.message ?? "Fecha inválida.";
  if (!greetingEmoji.success) errors.greetingEmoji = greetingEmoji.error.issues[0]?.message ?? "Emoji inválido.";
  if (!username.success || !birthday.success || !greetingEmoji.success) {
    return { status: "error", errors };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { username: username.data, birthday: birthday.data, greetingEmoji: greetingEmoji.data },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      ((error.meta as { target?: string[] } | undefined)?.target ?? []).includes("username")
    ) {
      return { status: "error", errors: { username: "Ya alguien más tiene ese nombre de usuario." } };
    }
    throw error;
  }

  revalidatePath("/perfil");
  revalidatePath("/");
  revalidatePath("/admin/cumpleanos");
  return { status: "success" };
}

export type BirthdayFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string };

/** Guarda (o borra, si viene vacía) la fecha de nacimiento propia, desde el aviso de la página principal. */
export async function updateMyBirthday(
  _prevState: BirthdayFormState,
  formData: FormData
): Promise<BirthdayFormState> {
  const user = await requireUser();

  const parsed = birthdaySchema.safeParse(formData.get("birthday") ?? "");
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Fecha inválida." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { birthday: parsed.data } });

  revalidatePath("/perfil");
  revalidatePath("/");
  revalidatePath("/admin/cumpleanos");
  return { status: "success" };
}

/** "Prefiero no decirlo" en el aviso de la página principal: deja de mostrarlo (se puede poner igual desde /perfil). */
export async function dismissBirthdayPrompt() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { birthdayPromptDismissed: true } });
  revalidatePath("/");
}
