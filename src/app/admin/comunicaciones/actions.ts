"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { communicationSchema } from "@/lib/communication-schema";
import { sanitizeRichTextHtml, htmlToPlainText } from "@/lib/rich-text";
import { sendCommunicationNow } from "@/lib/send-communication";

export type CommunicationFormState =
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

export async function createCommunication(
  _prevState: CommunicationFormState,
  formData: FormData
): Promise<CommunicationFormState> {
  const admin = await requireAdmin();

  const bodyHtml = sanitizeRichTextHtml(String(formData.get("bodyHtml") ?? ""));
  const bodyText = htmlToPlainText(bodyHtml);

  const parsed = communicationSchema.safeParse({
    subject: formData.get("subject"),
    audience: formData.get("audience"),
    recipientIds: formData.getAll("recipientIds").map(String),
    sendMode: formData.get("sendMode"),
    scheduledAt: formData.get("scheduledAt") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  if (!bodyText) {
    return { status: "error", fieldErrors: { bodyHtml: "Escribe el contenido del correo." } };
  }

  const data = parsed.data;
  const scheduledAt = data.sendMode === "now" ? new Date() : new Date(data.scheduledAt!);

  const communication = await prisma.communication.create({
    data: {
      subject: data.subject,
      bodyHtml,
      bodyText,
      audience: data.audience,
      recipientIds: data.audience === "selected" ? JSON.stringify(data.recipientIds) : "",
      scheduledAt,
      createdById: admin.id,
    },
  });

  if (data.sendMode === "now") {
    await sendCommunicationNow(communication.id);
  }

  revalidatePath("/admin/comunicaciones");
  return { status: "success" };
}

export async function updateScheduledCommunication(
  id: string,
  _prevState: CommunicationFormState,
  formData: FormData
): Promise<CommunicationFormState> {
  await requireAdmin();

  const existing = await prisma.communication.findUnique({ where: { id } });
  if (!existing || existing.status !== "scheduled") {
    return { status: "error", message: "Esta comunicación ya no se puede editar (puede que ya se haya enviado)." };
  }

  const bodyHtml = sanitizeRichTextHtml(String(formData.get("bodyHtml") ?? ""));
  const bodyText = htmlToPlainText(bodyHtml);

  const parsed = communicationSchema.safeParse({
    subject: formData.get("subject"),
    audience: formData.get("audience"),
    recipientIds: formData.getAll("recipientIds").map(String),
    sendMode: formData.get("sendMode"),
    scheduledAt: formData.get("scheduledAt") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  if (!bodyText) {
    return { status: "error", fieldErrors: { bodyHtml: "Escribe el contenido del correo." } };
  }

  const data = parsed.data;
  const scheduledAt = data.sendMode === "now" ? new Date() : new Date(data.scheduledAt!);

  await prisma.communication.update({
    where: { id },
    data: {
      subject: data.subject,
      bodyHtml,
      bodyText,
      audience: data.audience,
      recipientIds: data.audience === "selected" ? JSON.stringify(data.recipientIds) : "",
      scheduledAt,
    },
  });

  if (data.sendMode === "now") {
    await sendCommunicationNow(id);
  }

  revalidatePath("/admin/comunicaciones");
  revalidatePath(`/admin/comunicaciones/${id}`);
  return { status: "success" };
}

export async function cancelScheduledCommunication(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.communication.deleteMany({ where: { id, status: "scheduled" } });
  revalidatePath("/admin/comunicaciones");
  redirect("/admin/comunicaciones");
}
