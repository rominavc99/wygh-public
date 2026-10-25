"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { newInviteToken, sendGroupInvites } from "@/lib/groups";

const DAY_GREETING = "Hola, {nombre}, esto es lo que hicieron tus amigos ayer:";

export type GroupFormState =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string };

const nameSchema = z.string().trim().min(1, "Ponle un nombre.").max(60, "Máximo 60 caracteres.");

function isUniqueNameError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function revalidateGroup(groupId?: string) {
  revalidatePath("/admin/grupos");
  if (groupId) revalidatePath(`/admin/grupos/${groupId}`);
  revalidatePath("/admin/usuarios");
}

export async function createGroup(_prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  await requireAdmin();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Nombre inválido." };

  let id: string;
  try {
    // El default de la tabla es el saludo del formato anterior ("¿Qué harás al llegar?").
    id = (await prisma.group.create({ data: { name: parsed.data, greetingTemplate: DAY_GREETING } })).id;
  } catch (error) {
    if (isUniqueNameError(error)) return { status: "error", message: "Ya existe un grupo con ese nombre." };
    throw error;
  }
  revalidateGroup();
  redirect(`/admin/grupos/${id}`);
}

export async function renameGroup(groupId: string, _prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  await requireAdmin();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Nombre inválido." };
  try {
    await prisma.group.update({ where: { id: groupId }, data: { name: parsed.data } });
  } catch (error) {
    if (isUniqueNameError(error)) return { status: "error", message: "Ya existe un grupo con ese nombre." };
    throw error;
  }
  revalidateGroup(groupId);
  return { status: "success", message: "Nombre guardado." };
}

export async function setGroupSuspended(formData: FormData) {
  await requireAdmin();
  const groupId = String(formData.get("groupId") ?? "");
  const suspended = formData.get("suspended") === "true";
  if (!groupId) return;
  await prisma.group.update({ where: { id: groupId }, data: { suspended } });
  revalidateGroup(groupId);
}

/** enable: crea el enlace si no hay; regenerate: el anterior deja de servir; disable: lo apaga. */
export async function setInviteLink(formData: FormData) {
  await requireAdmin();
  const groupId = String(formData.get("groupId") ?? "");
  const mode = formData.get("mode");
  if (!groupId) return;
  if (mode === "disable") {
    await prisma.group.update({ where: { id: groupId }, data: { inviteToken: null } });
  } else if (mode === "regenerate" || mode === "enable") {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { inviteToken: true } });
    if (mode === "enable" && group?.inviteToken) return;
    await prisma.group.update({ where: { id: groupId }, data: { inviteToken: newInviteToken() } });
  }
  revalidateGroup(groupId);
}

function idsFrom(formData: FormData, field: string): string[] {
  return [...new Set(formData.getAll(field).filter((v): v is string => typeof v === "string" && v.length > 0))];
}

export async function addGroupMembers(groupId: string, _prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  await requireAdmin();
  const userIds = idsFrom(formData, "userIds");
  if (userIds.length === 0) return { status: "error", message: "Elige al menos a una persona." };

  const already = new Set(
    (await prisma.groupMember.findMany({ where: { groupId, userId: { in: userIds } }, select: { userId: true } })).map((m) => m.userId)
  );
  const toAdd = (await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } }))
    .map((u) => u.id)
    .filter((id) => !already.has(id));
  if (toAdd.length) await prisma.groupMember.createMany({ data: toAdd.map((userId) => ({ groupId, userId })) });

  revalidateGroup(groupId);
  return { status: "success", message: `${toAdd.length} persona${toAdd.length === 1 ? "" : "s"} agregada${toAdd.length === 1 ? "" : "s"}.` };
}

export async function removeGroupMember(formData: FormData) {
  await requireAdmin();
  const groupId = String(formData.get("groupId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!groupId || !userId) return;
  await prisma.groupMember.deleteMany({ where: { groupId, userId } });
  revalidateGroup(groupId);
}

export async function inviteToGroup(groupId: string, _prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const admin = await requireAdmin();
  const userIds = idsFrom(formData, "userIds");
  if (userIds.length === 0) return { status: "error", message: "Elige al menos a una persona." };

  const { total, sent } = await sendGroupInvites(groupId, userIds, admin.id);
  revalidateGroup(groupId);
  if (total === 0) return { status: "error", message: "Esas personas ya están en el grupo o no están activas." };
  if (sent === 0) return { status: "error", message: "No se pudo mandar ninguna invitación. Revisa el correo saliente." };
  return {
    status: "success",
    message: sent === total ? `Invitación enviada a ${sent} persona${sent === 1 ? "" : "s"}. ✉️` : `Se mandaron ${sent} de ${total} invitaciones.`,
  };
}

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "La URL debe empezar con http:// o https://");

const newsletterSchema = z
  .object({
    tagline: z.string().trim().max(200),
    greetingTemplate: z
      .string()
      .trim()
      .min(1, "Escribe un saludo.")
      .max(300)
      .refine((v) => v.includes("{nombre}"), 'El saludo debe incluir el marcador "{nombre}".'),
    sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM."),
    reminderEnabled: z.boolean(),
    heroEnabled: z.boolean(),
    heroTitle: z.string().trim().max(140),
    heroParagraph: z.string().trim().max(600),
    heroImageUrl: optionalUrl,
    heroLinkUrl: optionalUrl,
    heroLinkText: z.string().trim().max(40).or(z.literal("")),
    selectedPhraseId: z.string(),
  })
  .refine((v) => !v.heroEnabled || v.heroTitle.length > 0, {
    message: "Si activas la portada, escribe un título.",
    path: ["heroTitle"],
  });

export type GroupNewsletterState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> };

/** Ajustes del boletín de un grupo: saludo, hora, recordatorio, portada y frase fija. */
export async function updateGroupNewsletter(
  groupId: string,
  _prev: GroupNewsletterState,
  formData: FormData
): Promise<GroupNewsletterState> {
  await requireAdmin();
  const parsed = newsletterSchema.safeParse({
    tagline: formData.get("tagline"),
    greetingTemplate: formData.get("greetingTemplate"),
    sendTime: formData.get("sendTime"),
    reminderEnabled: formData.get("reminderEnabled") === "on",
    heroEnabled: formData.get("heroEnabled") === "on",
    heroTitle: formData.get("heroTitle"),
    heroParagraph: formData.get("heroParagraph"),
    heroImageUrl: formData.get("heroImageUrl"),
    heroLinkUrl: formData.get("heroLinkUrl"),
    heroLinkText: formData.get("heroLinkText"),
    selectedPhraseId: formData.get("selectedPhraseId") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors, message: "Revisa los campos marcados." };
  }

  await prisma.group.update({ where: { id: groupId }, data: parsed.data });
  revalidateGroup(groupId);
  revalidatePath("/admin/boletin");
  revalidatePath("/admin/frases");
  return { status: "success" };
}
