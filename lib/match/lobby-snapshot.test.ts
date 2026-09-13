import { describe, expect, it } from "vitest";

import { applyMatchSnapshotToLobby, withLobbyPresence } from "./lobby-snapshot";
import type { MatchLobbyDto } from "./types";
import type { MatchSnapshot } from "./protocol";

const lobby: MatchLobbyDto = {
  matchId: "11111111-1111-4111-8111-111111111111",
  status: "lobby",
  hostUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  hostRole: "player",
  youRole: "player_a",
  lobbyExpiresAt: new Date().toISOString(),
  seats: [
    { role: "player_a", userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", username: "host" },
    { role: "player_b", userId: null, username: null },
  ],
  invites: [
    {
      userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      username: "guest",
      status: "pending",
    },
  ],
  friends: [],
  canStart: false,
  winnerUserId: null,
  healthA: 6000,
  healthB: 6000,
};

function snapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    type: "matchSnapshot",
    matchId: lobby.matchId,
    phase: "lobby",
    hostUserId: lobby.hostUserId,
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
    youRole: "player_a",
    youLocked: false,
    youCanLock: false,
    opponentLocked: false,
    reveal: null,
    winnerUserId: null,
    ...overrides,
  };
}

describe("applyMatchSnapshotToLobby", () => {
  it("fills seats from the room and enables start when both players are connected", () => {
    const next = applyMatchSnapshotToLobby(lobby, snapshot());
    expect(next.seats[1]).toEqual({
      role: "player_b",
      userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      username: "guest",
    });
    expect(next.canStart).toBe(true);
    expect(next.invites[0]?.status).toBe("accepted");
  });

  it("does not enable start until both sockets are connected", () => {
    const next = applyMatchSnapshotToLobby(
      lobby,
      snapshot({
        playerB: {
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          username: "guest",
          connected: false,
          health: 6000,
          multiplier: 1,
          locked: false,
        },
      }),
    );
    expect(next.canStart).toBe(false);
  });

  it("keeps a known username when the room has not sent one yet", () => {
    const named = {
      ...lobby,
      seats: [
        lobby.seats[0]!,
        {
          role: "player_b" as const,
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          username: "guest",
        },
      ],
    };
    const next = applyMatchSnapshotToLobby(
      named,
      snapshot({
        playerB: {
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          username: null,
          connected: true,
          health: 6000,
          multiplier: 1,
          locked: false,
        },
      }),
    );
    expect(next.seats[1]?.username).toBe("guest");
  });

  it("marks the lobby cancelled when the room cancels", () => {
    const next = applyMatchSnapshotToLobby(
      lobby,
      snapshot({ phase: "cancelled" }),
    );
    expect(next.status).toBe("cancelled");
    expect(next.canStart).toBe(false);
  });

  it("does not enable start for a seated guest", () => {
    const guest = { ...lobby, youRole: "player_b" as const };
    const next = applyMatchSnapshotToLobby(guest, snapshot({ youRole: "player_b" }));
    expect(next.canStart).toBe(false);
  });

  it("enables start for an observer host when both players are connected", () => {
    const observerLobby: MatchLobbyDto = {
      ...lobby,
      hostRole: "observer",
      youRole: "host_observer",
      seats: [
        {
          role: "host_observer",
          userId: lobby.hostUserId,
          username: "host",
        },
        {
          role: "player_a",
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          username: "guest",
        },
        {
          role: "player_b",
          userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          username: "other",
        },
      ],
    };
    const next = applyMatchSnapshotToLobby(
      observerLobby,
      snapshot({
        youRole: "host_observer",
        playerA: {
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          username: "guest",
          connected: true,
          health: 6000,
          multiplier: 1,
          locked: false,
        },
        playerB: {
          userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          username: "other",
          connected: true,
          health: 6000,
          multiplier: 1,
          locked: false,
        },
        hostObserver: {
          userId: lobby.hostUserId,
          username: "host",
          connected: true,
          health: null,
          multiplier: null,
          locked: false,
        },
      }),
    );
    expect(next.canStart).toBe(true);
  });

  it("clears a vacated seat and lets the host invite that friend again", () => {
    const seated: MatchLobbyDto = {
      ...lobby,
      seats: [
        lobby.seats[0]!,
        {
          role: "player_b",
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          username: "guest",
        },
      ],
      invites: [
        {
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          username: "guest",
          status: "accepted",
        },
      ],
      friends: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", username: "guest", busy: false, online: true }],
    };
    const next = applyMatchSnapshotToLobby(
      seated,
      snapshot({
        playerB: {
          userId: null,
          username: null,
          connected: false,
          health: 6000,
          multiplier: 1,
          locked: false,
        },
      }),
    );
    expect(next.seats[1]).toEqual({
      role: "player_b",
      userId: null,
      username: null,
    });
    expect(next.invites[0]?.status).toBe("declined");
    expect(next.canStart).toBe(false);
  });

  it("does not clear HTTP seats when the room snapshot is still empty", () => {
    const accepted: MatchLobbyDto = {
      ...lobby,
      seats: [
        lobby.seats[0]!,
        {
          role: "player_b",
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          username: "guest",
        },
      ],
      invites: [
        {
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          username: "guest",
          status: "accepted",
        },
      ],
    };
    const next = withLobbyPresence(
      accepted,
      snapshot({
        playerB: {
          userId: null,
          username: null,
          connected: false,
          health: 6000,
          multiplier: 1,
          locked: false,
        },
      }),
    );
    expect(next.seats[1]?.userId).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    expect(next.invites[0]?.status).toBe("accepted");
    expect(next.canStart).toBe(false);
  });
});
