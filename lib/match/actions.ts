"use server";

import { requireExclusiveSession } from "@/lib/auth/check-exclusive-session";
import { SESSION_ID_RE } from "@/lib/auth/session-id";
import { config } from "@/lib/config";
import { isMatchHostRole } from "@/lib/game/match";
import {
  MatchEngineError,
  acceptInvite,
  createMatch,
  declineInvite,
  getMatchHome,
  getMatchLobby,
  getMatchSeat,
  hostRemovePlayer,
  invitePlayer,
  leaveMatch,
  startMatch,
} from "@/lib/match/engine";
import type { MatchErrorCode, MatchHomeDto, MatchLobbyDto } from "@/lib/match/types";
import { mintMatchJoinToken } from "@/party/match-join-token";

export type MatchActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: MatchErrorCode };

async function withExclusive<T>(
  clientSessionId: string | null,
  fn: (userId: string) => Promise<T>,
): Promise<MatchActionResult<T>> {
  const exclusive = await requireExclusiveSession(clientSessionId);
  if (!exclusive) return { ok: false, code: "forbidden" };
  try {
    return { ok: true, data: await fn(exclusive.id) };
  } catch (error) {
    if (error instanceof MatchEngineError) {
      return { ok: false, code: error.code };
    }
    throw error;
  }
}

function parseId(value: string): string | null {
  return SESSION_ID_RE.test(value) ? value : null;
}

export async function createMatchAction(
  clientSessionId: string | null,
  hostRole: string,
): Promise<MatchActionResult<MatchLobbyDto>> {
  if (!isMatchHostRole(hostRole)) return { ok: false, code: "not-found" };
  return withExclusive(clientSessionId, (userId) =>
    createMatch(userId, hostRole),
  );
}

export async function getMatchHomeAction(
  clientSessionId: string | null,
): Promise<MatchActionResult<MatchHomeDto>> {
  return withExclusive(clientSessionId, getMatchHome);
}

export async function getMatchLobbyAction(
  clientSessionId: string | null,
  matchId: string,
): Promise<MatchActionResult<MatchLobbyDto>> {
  const id = parseId(matchId);
  if (!id) return { ok: false, code: "not-found" };
  return withExclusive(clientSessionId, (userId) => getMatchLobby(userId, id));
}

export async function invitePlayerAction(
  clientSessionId: string | null,
  matchId: string,
  friendId: string,
): Promise<MatchActionResult<MatchLobbyDto>> {
  const id = parseId(matchId);
  const friend = parseId(friendId);
  if (!id || !friend) return { ok: false, code: "not-found" };
  return withExclusive(clientSessionId, (userId) =>
    invitePlayer(userId, id, friend),
  );
}

export async function acceptInviteAction(
  clientSessionId: string | null,
  matchId: string,
): Promise<MatchActionResult<MatchLobbyDto>> {
  const id = parseId(matchId);
  if (!id) return { ok: false, code: "not-found" };
  return withExclusive(clientSessionId, (userId) => acceptInvite(userId, id));
}

export async function declineInviteAction(
  clientSessionId: string | null,
  matchId: string,
): Promise<MatchActionResult<MatchHomeDto>> {
  const id = parseId(matchId);
  if (!id) return { ok: false, code: "not-found" };
  return withExclusive(clientSessionId, (userId) =>
    declineInvite(userId, id),
  );
}

export async function hostRemovePlayerAction(
  clientSessionId: string | null,
  matchId: string,
  targetUserId: string,
): Promise<MatchActionResult<MatchLobbyDto>> {
  const id = parseId(matchId);
  const target = parseId(targetUserId);
  if (!id || !target) return { ok: false, code: "not-found" };
  return withExclusive(clientSessionId, (userId) =>
    hostRemovePlayer(userId, id, target),
  );
}

export async function leaveMatchAction(
  clientSessionId: string | null,
  matchId: string,
): Promise<MatchActionResult<MatchHomeDto>> {
  const id = parseId(matchId);
  if (!id) return { ok: false, code: "not-found" };
  return withExclusive(clientSessionId, (userId) => leaveMatch(userId, id));
}

export async function startMatchAction(
  clientSessionId: string | null,
  matchId: string,
): Promise<MatchActionResult<MatchLobbyDto>> {
  const id = parseId(matchId);
  if (!id) return { ok: false, code: "not-found" };
  return withExclusive(clientSessionId, (userId) => startMatch(userId, id));
}

export async function mintMatchJoinTokenAction(
  clientSessionId: string | null,
  matchId: string,
): Promise<
  | { ok: true; token: string }
  | { ok: false; reason: "unavailable" | "forbidden" }
> {
  if (!config.matchRoomSecret) return { ok: false, reason: "unavailable" };
  const id = parseId(matchId);
  if (!id) return { ok: false, reason: "forbidden" };
  const exclusive = await requireExclusiveSession(clientSessionId);
  if (!exclusive) return { ok: false, reason: "forbidden" };
  const seat = await getMatchSeat(exclusive.id, id);
  if (!seat) return { ok: false, reason: "unavailable" };
  return {
    ok: true,
    token: await mintMatchJoinToken(
      config.matchRoomSecret,
      exclusive.id,
      id,
      seat.role,
    ),
  };
}
