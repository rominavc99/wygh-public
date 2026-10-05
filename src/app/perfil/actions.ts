"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { usernameSchema, birthdaySchema, greetingEmojiSchema } from "@/lib/user-schema";

export type UsernameFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string };

export async function updateMyUsername(
  _prevState: UsernameFormState,
  formData: FormData
): Promise<UsernameFormState> {
  const user = await requireUser();

  const parsed = usernameSchema.safeParse(formData.get("username") ?? "");
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Usuario inválido." };
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data: { username: parsed.data } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      ((error.meta as { target?: string[] } | undefined)?.target ?? []).includes("username")
    ) {
      return { status: "error", message: "Ya alguien más tiene ese nombre de usuario." };
    }
    throw error;
  }

  revalidatePath("/perfil");
  return { status: "success" };
}

export type BirthdayFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string };

/** Guarda (o borra, si viene vacía) la fecha de nacimiento propia. La usan /perfil y el aviso de la página principal. */
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

export type GreetingEmojiFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string };

/** Guarda el emoji del saludo de la página principal (vacío = volver al de siempre). */
export async function updateMyGreetingEmoji(
  _prevState: GreetingEmojiFormState,
  formData: FormData
): Promise<GreetingEmojiFormState> {
  const user = await requireUser();

  const parsed = greetingEmojiSchema.safeParse(formData.get("greetingEmoji") ?? "");
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Emoji inválido." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { greetingEmoji: parsed.data } });

  revalidatePath("/perfil");
  revalidatePath("/");
  return { status: "success" };
}

/** "Prefiero no decirlo" en el aviso de la página principal: deja de mostrarlo (se puede poner igual desde /perfil). */
export async function dismissBirthdayPrompt() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { birthdayPromptDismissed: true } });
  revalidatePath("/");
}
