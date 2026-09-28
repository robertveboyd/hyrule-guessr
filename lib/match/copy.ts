export const LOBBY_EXPIRY_LABEL = "Expires";

export function roundVerdict(input: {
  you: "a" | "b" | "observer";
  loser: "a" | "b" | null;
  playerAName: string;
  playerBName: string;
}): string {
  if (!input.loser) return "Tie";
  if (input.you === "observer") {
    const winnerName =
      input.loser === "a" ? input.playerBName : input.playerAName;
    return `${winnerName} wins the round`;
  }
  if (input.you === input.loser) return "You lost the round";
  return "You won the round";
}

export function matchEndingAfterReveal(input: {
  healthA: number;
  healthB: number;
  roundIndex: number;
  roundCount: number;
}): boolean {
  return (
    input.healthA === 0 ||
    input.healthB === 0 ||
    input.roundIndex >= input.roundCount
  );
}

export function matchRecap(input: {
  you: "a" | "b" | "observer";
  winnerUserId: string | null;
  healthA: number;
  healthB: number;
}): string {
  const ko = input.healthA === 0 || input.healthB === 0;
  if (!input.winnerUserId) {
    return ko ? "Both reached zero" : "Even health after the last round";
  }
  if (ko) {
    if (input.you === "observer") return "Knockout";
    const youWon =
      (input.you === "a" && input.healthB === 0) ||
      (input.you === "b" && input.healthA === 0);
    return youWon ? "Knockout" : "You were knocked out";
  }
  if (input.you === "observer") return "More health remaining";
  const youWon =
    (input.you === "a" && input.healthA > input.healthB) ||
    (input.you === "b" && input.healthB > input.healthA);
  return youWon ? "More health remaining" : "Opponent had more health";
}

export function startWaitCopy(input: {
  emptyName: string | null;
  joiningName: string | null;
}): string {
  if (input.emptyName) return `Waiting for ${input.emptyName}…`;
  if (input.joiningName) return `Waiting for ${input.joiningName}…`;
  return "Waiting for a player…";
}

export function lobbyHostHint(input: {
  canStart: boolean;
  canInviteOnline: boolean;
  waitingOnName: string | null;
}): string {
  if (input.canStart) return "Both players ready";
  if (input.waitingOnName) return `Waiting for ${input.waitingOnName}…`;
  if (input.canInviteOnline) return "Invite someone to start";
  return "Waiting for a player…";
}

export function openSeatInviteHint(input: {
  hasFriends: boolean;
  freeOnline: boolean;
  onlineBusy: boolean;
}): string | null {
  if (input.freeOnline) return null;
  if (!input.hasFriends) return "No friends yet";
  if (input.onlineBusy) return "Friends are busy";
  return "No friends online";
}

export function seatReconnecting(input: {
  phase: string;
  playerA: { connected: boolean; locked: boolean };
  playerB: { connected: boolean; locked: boolean };
}): boolean {
  if (input.phase !== "playing" && input.phase !== "grace") return false;
  return (
    (!input.playerA.connected && !input.playerA.locked) ||
    (!input.playerB.connected && !input.playerB.locked)
  );
}

export function playTimerHint(input: {
  phase: string;
  observer: boolean;
  youLocked: boolean;
  reconnecting: boolean;
}): string | null {
  if (input.reconnecting) return "Reconnect";
  if (input.phase !== "grace") return null;
  if (input.observer) return "A player locked in";
  if (input.youLocked) return "Waiting for opponent";
  return "Opponent locked in";
}
