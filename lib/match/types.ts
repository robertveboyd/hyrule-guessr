export const MATCH_HOME_POLL_MS = 4_000;

export type MatchErrorCode =
  | "forbidden"
  | "unavailable"
  | "not-found"
  | "not-host"
  | "not-friends"
  | "cannot-invite-self"
  | "player-busy"
  | "already-in-match"
  | "lobby-expired"
  | "not-lobby"
  | "not-pending"
  | "seats-full"
  | "players-not-connected"
  | "catalog-too-small"
  | "not-seated"
  | "match-over";

export type MatchHomeInviteDto = {
  matchId: string;
  hostUsername: string;
};

export type MatchHomeRejoinDto = {
  matchId: string;
  status: "lobby" | "live";
};

export type MatchHomeDto = {
  rejoin: MatchHomeRejoinDto | null;
  incomingInvites: MatchHomeInviteDto[];
};

export type MatchLobbySeatDto = {
  role: "player_a" | "player_b" | "host_observer";
  userId: string | null;
  username: string | null;
};

export type MatchLobbyInviteDto = {
  userId: string;
  username: string;
  status: "pending" | "accepted" | "declined";
};

export type MatchLobbyDto = {
  matchId: string;
  status: "lobby" | "live" | "cancelled" | "completed";
  hostUserId: string;
  hostRole: "player" | "observer";
  youRole: "player_a" | "player_b" | "host_observer" | "invitee" | "none";
  lobbyExpiresAt: string;
  seats: MatchLobbySeatDto[];
  invites: MatchLobbyInviteDto[];
  friends: { id: string; username: string; busy: boolean; online: boolean }[];
  canStart: boolean;
  winnerUserId: string | null;
  healthA: number | null;
  healthB: number | null;
};
