import { and, eq, gt, inArray, isNotNull, or } from "drizzle-orm";

import { friendships } from "@/lib/db/schema/friends";
import { matchSeats, matches } from "@/lib/db/schema/matches";

export function liveMatchStatuses() {
  return ["lobby", "live"] as const;
}

export function playerSeatRoles() {
  return ["player_a", "player_b"] as const;
}

export function friendsPairWhere(userId: string, otherId: string) {
  return or(
    and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, otherId)),
    and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, userId)),
  );
}

export function livePlayerSeatWhere(userId: string) {
  return and(
    eq(matchSeats.userId, userId),
    inArray(matchSeats.role, [...playerSeatRoles()]),
    isNotNull(matchSeats.userId),
  );
}

export function stillLive() {
  return or(
    eq(matches.status, "live"),
    and(eq(matches.status, "lobby"), gt(matches.lobbyExpiresAt, new Date())),
  );
}

export { matches };
