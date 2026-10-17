export const MATCH_ROOM_PARTY = "match-room";
export const MATCH_ROOM_CLOSE_UNAUTHORIZED = 4001;
export const MATCH_ROOM_CLOSE_REPLACED = 4000;
export const MATCH_ROOM_CLOSE_SPECTATORS_FULL = 4002;

export function shouldReconnectMatchRoom(
  code: number,
  phase: string | null,
) {
  if (phase === "over" || phase === "cancelled") return false;
  return (
    code !== MATCH_ROOM_CLOSE_UNAUTHORIZED &&
    code !== MATCH_ROOM_CLOSE_REPLACED &&
    code !== MATCH_ROOM_CLOSE_SPECTATORS_FULL
  );
}
