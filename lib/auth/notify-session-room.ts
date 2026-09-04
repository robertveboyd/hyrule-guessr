import "server-only";

import { USER_SESSION_PARTY } from "@/lib/auth/user-session-party";
import { config } from "@/lib/config";

const NOTIFY_TIMEOUT_MS = 2000;

export async function notifySessionRoom(userId: string, sessionId: string) {
  const { sessionRoomUrl, sessionRoomSecret } = config;
  if (!sessionRoomUrl || !sessionRoomSecret) return;

  try {
    const response = await fetch(
      `${sessionRoomUrl}/parties/${USER_SESSION_PARTY}/${encodeURIComponent(userId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionRoomSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
        signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      console.error(
        `UserSession kick failed for ${userId}: HTTP ${response.status}`,
      );
    }
  } catch (error) {
    console.error(`UserSession kick request failed for ${userId}:`, error);
  }
}
