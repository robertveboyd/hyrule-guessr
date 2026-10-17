import { describe, expect, it } from "vitest";

import { parseMatchInbound, parseMatchSnapshot } from "./protocol";

describe("parseMatchSnapshot", () => {
  it("accepts a lobby snapshot", () => {
    const snapshot = {
      type: "matchSnapshot" as const,
      matchId: "11111111-1111-4111-8111-111111111111",
      phase: "lobby" as const,
      hostUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      lobbyExpiresAt: 1,
      roundIndex: 0,
      roundCount: 0,
      multiplier: 1,
      imageUrl: null,
      endsAt: null,
      playerA: {
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        username: "host",
        connected: true,
        health: 6000,
        multiplier: 1,
        locked: false,
      },
      playerB: {
        userId: null,
        username: null,
        connected: false,
        health: 6000,
        multiplier: 1,
        locked: false,
      },
      hostObserver: {
        userId: null,
        username: null,
        connected: false,
        health: null,
        multiplier: null,
        locked: false,
      },
      youRole: "player_a" as const,
      youLocked: false,
      youCanLock: false,
      opponentLocked: false,
      reveal: null,
      winnerUserId: null,
    };
    expect(parseMatchSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("rejects a spike ping leftover", () => {
    expect(parseMatchSnapshot(JSON.stringify({ type: "spikePing" }))).toBeNull();
  });

  it("accepts spectator viewports and omits them when absent", () => {
    const snapshot = {
      type: "matchSnapshot" as const,
      matchId: "11111111-1111-4111-8111-111111111111",
      phase: "playing" as const,
      hostUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      lobbyExpiresAt: null,
      roundIndex: 1,
      roundCount: 5,
      multiplier: 1,
      imageUrl: "https://example.com/still.jpg",
      endsAt: 1,
      playerA: {
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        username: "host",
        connected: true,
        health: 6000,
        multiplier: 1,
        locked: false,
      },
      playerB: {
        userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "guest",
        connected: true,
        health: 6000,
        multiplier: 1,
        locked: false,
      },
      hostObserver: {
        userId: null,
        username: null,
        connected: false,
        health: null,
        multiplier: null,
        locked: false,
      },
      youRole: "spectator" as const,
      youLocked: false,
      youCanLock: false,
      opponentLocked: false,
      reveal: null,
      winnerUserId: null,
      viewA: { x: 10, z: -20, zoom: 4, pin: { x: 12, z: -18 } },
      viewB: { x: 0, z: 0, zoom: 3, pin: null },
    };
    expect(parseMatchSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe("parseMatchInbound", () => {
  it("accepts a finite lock-in and drops non-finite coords", () => {
    expect(
      parseMatchInbound(JSON.stringify({ type: "lockIn", x: 10, z: -20 })),
    ).toEqual({ type: "lockIn", x: 10, z: -20 });
    expect(
      parseMatchInbound(JSON.stringify({ type: "lockIn", x: null, z: 0 })),
    ).toBeNull();
  });

  it("accepts a mapMoved viewport with an uncommitted pin", () => {
    expect(
      parseMatchInbound(
        JSON.stringify({
          type: "mapMoved",
          x: 100,
          z: -50,
          zoom: 5,
          pin: { x: 110, z: -40 },
        }),
      ),
    ).toEqual({
      type: "mapMoved",
      x: 100,
      z: -50,
      zoom: 5,
      pin: { x: 110, z: -40 },
    });
  });
});
