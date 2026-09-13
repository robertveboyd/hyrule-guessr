import "server-only";

import { MATCH_ROOM_PARTY } from "@/lib/match/party";
import { config } from "@/lib/config";

const TIMEOUT_MS = 4000;

export class MatchRoomNotifyError extends Error {
  constructor(readonly status?: number) {
    super("match-room-unavailable");
    this.name = "MatchRoomNotifyError";
  }
}

export async function notifyMatchRoom(
  matchId: string,
  body: unknown,
): Promise<Response> {
  const { matchRoomUrl, matchRoomSecret } = config;
  if (!matchRoomUrl || !matchRoomSecret) {
    throw new MatchRoomNotifyError();
  }

  const response = await fetch(
    `${matchRoomUrl}/parties/${MATCH_ROOM_PARTY}/${encodeURIComponent(matchId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${matchRoomSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new MatchRoomNotifyError(response.status);
  }
  return response;
}

export function matchRoomConfigured() {
  return Boolean(config.matchRoomUrl && config.matchRoomSecret);
}
