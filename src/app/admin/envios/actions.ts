"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";

export async function toggleArchived(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id");
  const nextArchived = formData.get("nextArchived") === "true";
  if (typeof id !== "string" || !id) return;

  await prisma.newsletterSend.update({ where: { id }, data: { archived: nextArchived } });

  revalidatePath("/admin/envios");
  revalidatePath("/boletines");
}
