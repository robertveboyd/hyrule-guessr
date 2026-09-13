export function matchErrorMessage(code: string): string {
  switch (code) {
    case "unavailable":
      return "Can't reach the match server. Try again.";
    case "not-found":
      return "That match is gone.";
    case "not-host":
      return "Only the host can do that.";
    case "not-friends":
      return "You can only invite friends.";
    case "cannot-invite-self":
      return "You cannot invite yourself.";
    case "player-busy":
      return "They're already in a match. Ask them to finish or leave.";
    case "already-in-match":
      return "You already have a match in progress. Rejoin or leave it first.";
    case "lobby-expired":
      return "That lobby expired.";
    case "not-lobby":
      return "The match has already started.";
    case "not-pending":
      return "That invite is no longer pending.";
    case "seats-full":
      return "Both player seats are filled.";
    case "players-not-connected":
      return "Both players must be connected to start.";
    case "catalog-too-small":
      return "Need at least 5 stills in the catalog to start a match.";
    case "not-seated":
      return "You are not in that match.";
    case "match-over":
      return "That match is over.";
    case "forbidden":
      return "This tab is no longer the active session.";
    default:
      return "Something went wrong. Try again.";
  }
}

export const MATCH_UNEXPECTED_MESSAGE = "Something went wrong. Try again.";
