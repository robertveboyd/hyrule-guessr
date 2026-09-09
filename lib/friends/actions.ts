"use server";

import { requireExclusiveSession } from "@/lib/auth/check-exclusive-session";
import { SESSION_ID_RE } from "@/lib/auth/session-id";

import {
  acceptFriend,
  clearPresence,
  FriendsEngineError,
  heartbeatPresence,
  listFriends,
  rejectFriend,
  requestFriend,
  searchUsers,
  unfriend,
} from "./engine";
import type { FriendsErrorCode, FriendsListDto, SearchHitDto } from "./types";

export type { FriendsErrorCode };

export type FriendsActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: FriendsErrorCode };

function parseUserId(value: string): string | null {
  return SESSION_ID_RE.test(value) ? value : null;
}

async function withExclusive<T>(
  clientSessionId: string | null,
  fn: (userId: string) => Promise<T>,
): Promise<FriendsActionResult<T>> {
  const exclusive = await requireExclusiveSession(clientSessionId);
  if (!exclusive) return { ok: false, code: "forbidden" };
  try {
    return { ok: true, data: await fn(exclusive.id) };
  } catch (error) {
    if (error instanceof FriendsEngineError) {
      return { ok: false, code: error.code };
    }
    throw error;
  }
}

export async function listFriendsAction(
  clientSessionId: string | null,
): Promise<FriendsActionResult<FriendsListDto>> {
  return withExclusive(clientSessionId, listFriends);
}

export async function searchUsersAction(
  clientSessionId: string | null,
  query: string,
): Promise<FriendsActionResult<SearchHitDto[]>> {
  return withExclusive(clientSessionId, (userId) =>
    searchUsers(userId, query),
  );
}

export async function requestFriendAction(
  clientSessionId: string | null,
  otherId: string,
): Promise<FriendsActionResult<FriendsListDto>> {
  const parsed = parseUserId(otherId);
  if (!parsed) return { ok: false, code: "user-not-found" };
  return withExclusive(clientSessionId, (userId) =>
    requestFriend(userId, parsed),
  );
}

export async function acceptFriendAction(
  clientSessionId: string | null,
  otherId: string,
): Promise<FriendsActionResult<FriendsListDto>> {
  const parsed = parseUserId(otherId);
  if (!parsed) return { ok: false, code: "user-not-found" };
  return withExclusive(clientSessionId, (userId) =>
    acceptFriend(userId, parsed),
  );
}

export async function rejectFriendAction(
  clientSessionId: string | null,
  otherId: string,
): Promise<FriendsActionResult<FriendsListDto>> {
  const parsed = parseUserId(otherId);
  if (!parsed) return { ok: false, code: "user-not-found" };
  return withExclusive(clientSessionId, (userId) =>
    rejectFriend(userId, parsed),
  );
}

export async function unfriendAction(
  clientSessionId: string | null,
  otherId: string,
): Promise<FriendsActionResult<FriendsListDto>> {
  const parsed = parseUserId(otherId);
  if (!parsed) return { ok: false, code: "user-not-found" };
  return withExclusive(clientSessionId, (userId) =>
    unfriend(userId, parsed),
  );
}

export async function heartbeatPresenceAction(
  clientSessionId: string | null,
): Promise<FriendsActionResult<null>> {
  return withExclusive(clientSessionId, async (userId) => {
    await heartbeatPresence(userId);
    return null;
  });
}

export async function clearPresenceAction(
  clientSessionId: string | null,
): Promise<FriendsActionResult<null>> {
  return withExclusive(clientSessionId, async (userId) => {
    await clearPresence(userId);
    return null;
  });
}
