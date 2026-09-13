"use client";

import { PartySocket } from "partysocket";

import { sendToLogin } from "@/lib/auth/send-to-login";
import { readSessionId } from "@/lib/auth/session-storage";
import { mintMatchJoinTokenAction } from "@/lib/match/actions";
import {
  MATCH_ROOM_CLOSE_UNAUTHORIZED,
  MATCH_ROOM_PARTY,
  shouldReconnectMatchRoom,
} from "@/lib/match/party";
import { parseMatchSnapshot, type MatchSnapshot } from "@/lib/match/protocol";

export type MatchRoomSend = (type: "lockIn", point: { x: number; z: number }) => void;

export async function connectMatchRoom({
  matchId,
  onSnapshot,
  onUnavailable,
}: {
  matchId: string;
  onSnapshot: (snapshot: MatchSnapshot) => void;
  onUnavailable?: () => void;
}): Promise<{ close: () => void; send: MatchRoomSend }> {
  const noop: MatchRoomSend = () => {};
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (!host) {
    onUnavailable?.();
    return { close: () => {}, send: noop };
  }

  const minted = await mintMatchJoinTokenAction(readSessionId(), matchId);
  if (!minted.ok) {
    if (minted.reason === "forbidden") sendToLogin();
    else onUnavailable?.();
    return { close: () => {}, send: noop };
  }

  let kicked = false;
  let phase: MatchSnapshot["phase"] | null = null;
  const session = { socket: undefined as PartySocket | undefined };
  const kick = () => {
    if (kicked) return;
    kicked = true;
    session.socket?.close();
    sendToLogin();
  };

  const socket = new PartySocket({
    host,
    party: MATCH_ROOM_PARTY,
    room: matchId,
    query: async () => {
      if (phase === "over" || phase === "cancelled") return {};
      const next = await mintMatchJoinTokenAction(readSessionId(), matchId);
      if (!next.ok) {
        if (next.reason === "forbidden") kick();
        else onUnavailable?.();
        return {};
      }
      return { token: next.token };
    },
    shouldReconnectOnClose: (event) =>
      shouldReconnectMatchRoom(event.code, phase),
  });
  session.socket = socket;

  const handleMessage = (event: MessageEvent<string>) => {
    const snapshot = parseMatchSnapshot(event.data);
    if (!snapshot) return;
    phase = snapshot.phase;
    onSnapshot(snapshot);
  };

  socket.addEventListener("message", handleMessage);
  const handleClose = (event: CloseEvent) => {
    if (
      event.code === MATCH_ROOM_CLOSE_UNAUTHORIZED &&
      phase !== "over" &&
      phase !== "cancelled"
    ) {
      onUnavailable?.();
    }
  };
  socket.addEventListener("close", handleClose);

  return {
    close: () => {
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.close();
    },
    send: (type, point) => {
      socket.send(JSON.stringify({ type, x: point.x, z: point.z }));
    },
  };
}
