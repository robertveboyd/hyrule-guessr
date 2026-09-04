"use server";

import { requireExclusiveSession } from "@/lib/auth/check-exclusive-session";
import { config } from "@/lib/config";
import { mintJoinToken } from "@/party/join-token";

export async function mintJoinTokenAction(
  clientSessionId: string | null,
): Promise<string | null> {
  if (!config.sessionRoomSecret) return null;

  const exclusive = await requireExclusiveSession(clientSessionId);
  if (!exclusive || !clientSessionId) return null;

  return mintJoinToken(
    config.sessionRoomSecret,
    exclusive.id,
    clientSessionId,
  );
}
