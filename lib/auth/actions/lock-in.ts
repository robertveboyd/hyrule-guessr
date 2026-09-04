"use server";

import { requireExclusiveSession } from "@/lib/auth/check-exclusive-session";

export async function lockInAction(
  sessionId: string | null,
): Promise<{ ok: boolean }> {
  const exclusive = await requireExclusiveSession(sessionId);
  if (!exclusive) return { ok: false };
  return { ok: true };
}
