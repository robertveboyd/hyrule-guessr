import { describe, expect, it } from "vitest";

import {
  MATCH_ROOM_CLOSE_REPLACED,
  MATCH_ROOM_CLOSE_UNAUTHORIZED,
  shouldReconnectMatchRoom,
} from "./party";

describe("shouldReconnectMatchRoom", () => {
  it("reconnects after a normal close during play", () => {
    expect(shouldReconnectMatchRoom(1006, "playing")).toBe(true);
    expect(shouldReconnectMatchRoom(1006, "lobby")).toBe(true);
  });

  it("does not reconnect after a finished or cancelled match", () => {
    expect(shouldReconnectMatchRoom(1006, "over")).toBe(false);
    expect(shouldReconnectMatchRoom(1006, "cancelled")).toBe(false);
  });

  it("does not reconnect after unauthorized or replaced closes", () => {
    expect(
      shouldReconnectMatchRoom(MATCH_ROOM_CLOSE_UNAUTHORIZED, "playing"),
    ).toBe(false);
    expect(
      shouldReconnectMatchRoom(MATCH_ROOM_CLOSE_REPLACED, "playing"),
    ).toBe(false);
  });
});
