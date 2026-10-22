"use server";

import { requireUser } from "@/lib/auth-guards";
import { joinGroupWithToken, type JoinResult } from "@/lib/groups";

export async function joinGroup(token: string): Promise<JoinResult> {
  const user = await requireUser();
  return joinGroupWithToken(user.id, token);
}
