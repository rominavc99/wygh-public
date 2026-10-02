"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";

export async function toggleArchived(formData: FormData) {
  await requireAdmin();

  const date = formData.get("date");
  const nextArchived = formData.get("nextArchived") === "true";
  if (typeof date !== "string" || !date) return;

  await prisma.newsletterSend.update({ where: { date }, data: { archived: nextArchived } });

  revalidatePath("/admin/envios");
  revalidatePath("/boletines");
}
