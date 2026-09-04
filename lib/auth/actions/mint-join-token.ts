"use server";

import { requireExclusiveSession } from "@/lib/auth/check-exclusive-session";
import { config } from "@/lib/config";
import { mintJoinToken } from "@/party/join-token";

export type MintJoinTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unavailable" | "forbidden" };

export async function mintJoinTokenAction(
  clientSessionId: string | null,
): Promise<MintJoinTokenResult> {
  if (!config.sessionRoomSecret) return { ok: false, reason: "unavailable" };

  const exclusive = await requireExclusiveSession(clientSessionId);
  if (!exclusive || !clientSessionId) {
    return { ok: false, reason: "forbidden" };
  }

  return {
    ok: true,
    token: await mintJoinToken(
      config.sessionRoomSecret,
      exclusive.id,
      clientSessionId,
    ),
  };
}
