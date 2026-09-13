import type { MatchLobbyDto } from "@/lib/match/types";
import type { MatchSnapshot } from "@/lib/match/protocol";

function mergeSeat(
  seat: MatchLobbyDto["seats"][number],
  publicSeat: { userId: string | null; username: string | null },
) {
  if (!publicSeat.userId) {
    return { ...seat, userId: null, username: null };
  }
  return {
    ...seat,
    userId: publicSeat.userId,
    username: publicSeat.username ?? seat.username,
  };
}

export function withLobbyPresence(
  lobby: MatchLobbyDto,
  snapshot: MatchSnapshot,
): MatchLobbyDto {
  const playerA = lobby.seats.find((seat) => seat.role === "player_a");
  const playerB = lobby.seats.find((seat) => seat.role === "player_b");
  const bothFilled = Boolean(playerA?.userId && playerB?.userId);
  const bothConnected =
    Boolean(playerA?.userId) &&
    Boolean(playerB?.userId) &&
    snapshot.playerA.userId === playerA?.userId &&
    snapshot.playerB.userId === playerB?.userId &&
    snapshot.playerA.connected &&
    snapshot.playerB.connected;
  const isHost =
    lobby.youRole === "host_observer" ||
    (lobby.hostRole === "player" && lobby.youRole === "player_a");
  const status =
    snapshot.phase === "cancelled"
      ? "cancelled"
      : snapshot.phase !== "lobby" && lobby.status === "lobby"
        ? "live"
        : lobby.status;
  return {
    ...lobby,
    status,
    canStart: status === "lobby" && isHost && bothFilled && bothConnected,
  };
}

export function applyMatchSnapshotToLobby(
  lobby: MatchLobbyDto,
  snapshot: MatchSnapshot,
): MatchLobbyDto {
  const seats = lobby.seats.map((seat) => {
    if (seat.role === "player_a") return mergeSeat(seat, snapshot.playerA);
    if (seat.role === "player_b") {
      return mergeSeat(seat, snapshot.playerB);
    }
    return mergeSeat(seat, snapshot.hostObserver);
  });
  const seatedIds = new Set(
    seats.map((seat) => seat.userId).filter((id): id is string => Boolean(id)),
  );
  const playerA = seats.find((seat) => seat.role === "player_a");
  const playerB = seats.find((seat) => seat.role === "player_b");
  const bothFilled = Boolean(playerA?.userId && playerB?.userId);
  const bothConnected =
    snapshot.playerA.connected && snapshot.playerB.connected;
  const isHost =
    lobby.youRole === "host_observer" ||
    (lobby.hostRole === "player" && lobby.youRole === "player_a");
  const status =
    snapshot.phase === "cancelled"
      ? "cancelled"
      : snapshot.phase !== "lobby" && lobby.status === "lobby"
        ? "live"
        : lobby.status;
  return {
    ...lobby,
    status,
    seats,
    invites: lobby.invites.map((invite) => {
      if (seatedIds.has(invite.userId)) {
        return invite.status === "pending"
          ? { ...invite, status: "accepted" as const }
          : invite;
      }
      if (invite.status === "accepted") {
        return { ...invite, status: "declined" as const };
      }
      return invite;
    }),
    canStart: status === "lobby" && isHost && bothFilled && bothConnected,
  };
}
