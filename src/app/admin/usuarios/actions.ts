"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { userSchema } from "@/lib/user-schema";
import { resetRateLimit, loginEmailRateKey } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/send-extras";

export type UserFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> };

function fieldErrorsFromZod(error: import("zod").ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray((error.meta as { target?: string[] } | undefined)?.target) &&
    ((error.meta as { target?: string[] }).target ?? []).includes(field)
  );
}

export async function createUser(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    username: formData.get("username") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  let createdId: string;
  try {
    createdId = (await prisma.user.create({ data: parsed.data })).id;
    // Si la persona intentó entrar antes de existir, pudo haber gastado su
    // límite de enlaces — que pueda entrar de inmediato.
    resetRateLimit(loginEmailRateKey(parsed.data.email));
  } catch (error) {
    if (isUniqueConstraintError(error, "name")) {
      return { status: "error", fieldErrors: { name: "Ya existe una persona con ese nombre." } };
    }
    if (isUniqueConstraintError(error, "email")) {
      return { status: "error", fieldErrors: { email: "Ya existe una persona con ese correo." } };
    }
    if (isUniqueConstraintError(error, "username")) {
      return { status: "error", fieldErrors: { username: "Ya existe alguien con ese nombre de usuario." } };
    }
    throw error;
  }

  await sendWelcomeEmail(createdId);

  revalidatePath("/admin/usuarios");
  return { status: "success" };
}

export async function updateUser(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Usuario inválido." };
  }

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    username: formData.get("username") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.user.update({ where: { id }, data: parsed.data });
    resetRateLimit(loginEmailRateKey(parsed.data.email));
  } catch (error) {
    if (isUniqueConstraintError(error, "name")) {
      return { status: "error", fieldErrors: { name: "Ya existe una persona con ese nombre." } };
    }
    if (isUniqueConstraintError(error, "email")) {
      return { status: "error", fieldErrors: { email: "Ya existe una persona con ese correo." } };
    }
    if (isUniqueConstraintError(error, "username")) {
      return { status: "error", fieldErrors: { username: "Ya existe alguien con ese nombre de usuario." } };
    }
    throw error;
  }

  revalidatePath("/admin/usuarios");
  return { status: "success" };
}

export async function toggleUserActive(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id");
  const nextActive = formData.get("nextActive") === "true";
  if (typeof id !== "string" || !id) return;

  const user = await prisma.user.update({ where: { id }, data: { active: nextActive } });
  if (nextActive) resetRateLimit(loginEmailRateKey(user.email));
  revalidatePath("/admin/usuarios");
}
