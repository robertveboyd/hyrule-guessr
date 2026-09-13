export const MATCH_START_HEALTH = 6000;
export const MATCH_START_MULTIPLIER = 1;
export const MATCH_MULTIPLIER_STEP = 0.5;
export const MATCH_MAX_ROUNDS = 10;
export const MATCH_MIN_STILLS = 5;
export const MATCH_ROUND_MS = 60_000;
export const MATCH_GRACE_MS = 15_000;
export const MATCH_LOCK_IN_GRACE_MS = 1_000;
export const MATCH_RECONNECT_MS = 60_000;
export const MATCH_BETWEEN_ROUNDS_MS = 5_000;
export const MATCH_LOBBY_TTL_MS = 15 * 60 * 1000;

export const MATCH_HOST_ROLES = ["player", "observer"] as const;
export type MatchHostRole = (typeof MATCH_HOST_ROLES)[number];

export function isMatchHostRole(value: unknown): value is MatchHostRole {
  return MATCH_HOST_ROLES.includes(value as MatchHostRole);
}

export const MATCH_SEAT_ROLES = [
  "player_a",
  "player_b",
  "host_observer",
] as const;
export type MatchSeatRole = (typeof MATCH_SEAT_ROLES)[number];

export function isMatchSeatRole(value: unknown): value is MatchSeatRole {
  return MATCH_SEAT_ROLES.includes(value as MatchSeatRole);
}

export const MATCH_SOCKET_ROLES = [
  "playerA",
  "playerB",
  "hostObserver",
] as const;
export type MatchSocketRole = (typeof MATCH_SOCKET_ROLES)[number];

export function seatRoleToSocketRole(role: MatchSeatRole): MatchSocketRole {
  if (role === "player_a") return "playerA";
  if (role === "player_b") return "playerB";
  return "hostObserver";
}

export function socketRoleToSeatRole(role: MatchSocketRole): MatchSeatRole {
  if (role === "playerA") return "player_a";
  if (role === "playerB") return "player_b";
  return "host_observer";
}
