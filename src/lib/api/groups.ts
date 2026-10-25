import { canAccessGroup } from "@/lib/groups";
import { notFound } from "@/lib/api/http";

/** 404 (no 403) si no tiene acceso, para no confirmar que el grupo existe. */
export async function requireGroupAccess(user: { id: string; role: string }, groupId: string): Promise<void> {
  if (!(await canAccessGroup(user, groupId))) throw notFound("No encontramos ese grupo.");
}
