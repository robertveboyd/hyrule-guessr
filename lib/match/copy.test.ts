import { describe, expect, it } from "vitest";

import {
  matchEndingAfterReveal,
  matchRecap,
  playTimerHint,
  roundVerdict,
  startWaitCopy,
  lobbyHostHint,
  openSeatInviteHint,
} from "./copy";

describe("roundVerdict", () => {
  it("names a tie, a personal win, and an observer winner", () => {
    expect(
      roundVerdict({
        you: "a",
        loser: null,
        playerAName: "Link",
        playerBName: "Zelda",
      }),
    ).toBe("Tie");
    expect(
      roundVerdict({
        you: "a",
        loser: "b",
        playerAName: "Link",
        playerBName: "Zelda",
      }),
    ).toBe("You won the round");
    expect(
      roundVerdict({
        you: "observer",
        loser: "a",
        playerAName: "Link",
        playerBName: "Zelda",
      }),
    ).toBe("Zelda wins the round");
  });
});

describe("matchEndingAfterReveal", () => {
  it("ends on KO or the last scheduled round", () => {
    expect(
      matchEndingAfterReveal({
        healthA: 0,
        healthB: 4000,
        roundIndex: 3,
        roundCount: 10,
      }),
    ).toBe(true);
    expect(
      matchEndingAfterReveal({
        healthA: 100,
        healthB: 200,
        roundIndex: 10,
        roundCount: 10,
      }),
    ).toBe(true);
    expect(
      matchEndingAfterReveal({
        healthA: 100,
        healthB: 200,
        roundIndex: 4,
        roundCount: 10,
      }),
    ).toBe(false);
  });
});

describe("matchRecap", () => {
  it("explains knockout, health, and draws", () => {
    expect(
      matchRecap({
        you: "a",
        winnerUserId: "b",
        healthA: 0,
        healthB: 3000,
      }),
    ).toBe("You were knocked out");
    expect(
      matchRecap({
        you: "a",
        winnerUserId: "a",
        healthA: 2000,
        healthB: 500,
      }),
    ).toBe("More health remaining");
    expect(
      matchRecap({
        you: "b",
        winnerUserId: null,
        healthA: 100,
        healthB: 100,
      }),
    ).toBe("Even health after the last round");
  });
});

describe("startWaitCopy", () => {
  it("names the invited or joining player", () => {
    expect(startWaitCopy({ emptyName: "Zelda", joiningName: null })).toBe(
      "Waiting for Zelda…",
    );
    expect(startWaitCopy({ emptyName: null, joiningName: "Link" })).toBe(
      "Waiting for Link…",
    );
  });
});

describe("lobbyHostHint", () => {
  it("points at invite until someone is waiting or ready", () => {
    expect(
      lobbyHostHint({
        canStart: true,
        canInviteOnline: true,
        waitingOnName: "Zelda",
      }),
    ).toBe("Both players ready");
    expect(
      lobbyHostHint({
        canStart: false,
        canInviteOnline: true,
        waitingOnName: null,
      }),
    ).toBe("Invite someone to start");
    expect(
      lobbyHostHint({
        canStart: false,
        canInviteOnline: true,
        waitingOnName: "Zelda",
      }),
    ).toBe("Waiting for Zelda…");
  });
});

describe("openSeatInviteHint", () => {
  it("separates no friends, offline, and busy", () => {
    expect(
      openSeatInviteHint({
        hasFriends: false,
        freeOnline: false,
        onlineBusy: false,
      }),
    ).toBe("No friends yet");
    expect(
      openSeatInviteHint({
        hasFriends: true,
        freeOnline: false,
        onlineBusy: false,
      }),
    ).toBe("No friends online");
    expect(
      openSeatInviteHint({
        hasFriends: true,
        freeOnline: false,
        onlineBusy: true,
      }),
    ).toBe("Friends are busy");
    expect(
      openSeatInviteHint({
        hasFriends: true,
        freeOnline: true,
        onlineBusy: true,
      }),
    ).toBeNull();
  });
});

describe("playTimerHint", () => {
  it("labels reconnect before grace, then opponent lock-in", () => {
    expect(
      playTimerHint({
        phase: "playing",
        observer: false,
        youLocked: false,
        reconnecting: true,
      }),
    ).toBe("Reconnect");
    expect(
      playTimerHint({
        phase: "grace",
        observer: false,
        youLocked: false,
        reconnecting: false,
      }),
    ).toBe("Opponent locked in");
    expect(
      playTimerHint({
        phase: "grace",
        observer: false,
        youLocked: true,
        reconnecting: false,
      }),
    ).toBe("Waiting for opponent");
  });
});
