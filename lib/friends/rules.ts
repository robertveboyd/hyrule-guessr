import {
  PRESENCE_TTL_MS,
  type FriendRelation,
  type FriendRequestDecision,
  type FriendRequestRow,
  type PublicUserDto,
} from "./types";

export function isOnline(
  lastSeenAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!lastSeenAt) return false;
  return now.getTime() - lastSeenAt.getTime() < PRESENCE_TTL_MS;
}

export function escapeIlike(query: string): string {
  return query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function toPublicUser(row: {
  id: string;
  username: string;
  avatarId: string;
}): PublicUserDto {
  return {
    id: row.id,
    username: row.username,
    avatarId: row.avatarId,
  };
}

export function decideFriendRequest(
  fromId: string,
  toId: string,
  existing: FriendRequestRow | null,
): FriendRequestDecision {
  if (fromId === toId) return "self";
  if (!existing) return "insert";
  if (existing.status === "accepted") return "noop";
  if (existing.requesterId === fromId) return "noop";
  return "accept-opposite";
}

export function relationFor(
  userId: string,
  otherId: string,
  existing: FriendRequestRow | null,
): FriendRelation {
  if (!existing) return "none";
  if (existing.status === "accepted") return "friends";
  if (existing.requesterId === userId && existing.addresseeId === otherId) {
    return "outgoing";
  }
  if (existing.requesterId === otherId && existing.addresseeId === userId) {
    return "incoming";
  }
  return "none";
}
