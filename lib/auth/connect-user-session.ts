"use client";

import { PartySocket } from "partysocket";
import { z } from "zod";

import { mintJoinTokenAction } from "@/lib/auth/actions/mint-join-token";
import { readSessionId } from "@/lib/auth/session-storage";
import {
  USER_SESSION_CLOSE_REPLACED,
  USER_SESSION_CLOSE_UNAUTHORIZED,
  USER_SESSION_PARTY,
} from "@/lib/auth/user-session-party";

const sessionReplacedSchema = z.object({
  type: z.literal("sessionReplaced"),
  sessionId: z.string(),
});

function readReplacedSessionId(data: string): string | null {
  try {
    const parsed = sessionReplacedSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data.sessionId : null;
  } catch {
    return null;
  }
}

export async function connectUserSessionParty({
  userId,
  onKicked,
}: {
  userId: string;
  onKicked: () => void;
}): Promise<() => void> {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (!host) return () => {};

  const minted = await mintJoinTokenAction(readSessionId());
  if (!minted.ok) {
    if (minted.reason === "forbidden") onKicked();
    return () => {};
  }

  let kicked = false;
  let socket: PartySocket | undefined;

  const kick = () => {
    if (kicked) return;
    kicked = true;
    socket?.close();
    onKicked();
  };

  const confirmReplacedKick = async () => {
    try {
      const result = await mintJoinTokenAction(readSessionId());
      if (!result.ok && result.reason === "forbidden") kick();
    } catch {
      // Stay; Postgres is the lock. A failed probe must not evict the winner.
    }
  };

  socket = new PartySocket({
    host,
    party: USER_SESSION_PARTY,
    room: userId,
    query: async () => {
      const next = await mintJoinTokenAction(readSessionId());
      if (!next.ok) {
        if (next.reason === "forbidden") kick();
        return {};
      }
      return { token: next.token };
    },
    shouldReconnectOnClose: (event) =>
      event.code !== USER_SESSION_CLOSE_REPLACED &&
      event.code !== USER_SESSION_CLOSE_UNAUTHORIZED,
  });

  const onMessage = (event: MessageEvent<string>) => {
    const sessionId = readReplacedSessionId(event.data);
    if (!sessionId) return;
    if (readSessionId() === sessionId) return;
    kick();
  };

  const onClose = (event: CloseEvent) => {
    if (event.code === USER_SESSION_CLOSE_REPLACED) {
      void confirmReplacedKick();
    }
  };

  socket.addEventListener("message", onMessage);
  socket.addEventListener("close", onClose);

  return () => {
    socket?.removeEventListener("message", onMessage);
    socket?.removeEventListener("close", onClose);
    socket?.close();
  };
}
