import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const engine = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "engine.ts"),
  "utf8",
);

describe("createMatch", () => {
  it("cancels the room if initLobby fails after the row is inserted", () => {
    const start = engine.indexOf("export async function createMatch");
    const end = engine.indexOf("export async function invitePlayer");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body.indexOf("db.delete(matches)")).toBeLessThan(
      body.indexOf('type: "cancel"'),
    );
  });
});

describe("hasLiveMatch", () => {
  it("ignores expired lobbies when checking if a player is busy", () => {
    const start = engine.indexOf("async function hasLivePlayerSeat");
    const end = engine.indexOf("async function notifyMatchRoomRetry");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("stillLive");
  });
});

describe("toLobbyDto", () => {
  it("marks friends who already have a live match busy", () => {
    const start = engine.indexOf("async function toLobbyDto");
    const end = engine.indexOf("export async function createMatch");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("busyFriendIds");
    expect(body).toContain("stillLive");
    expect(body).toContain("busy: busyFriendIds.has(row.id)");
    expect(body).toContain("isOnline");
    expect(body).toContain("lastSeenAt");
    expect(body).toContain("ne(matches.id, matchId)");
  });
});

describe("invitePlayer", () => {
  it("rejects self, non-friends, and busy players", () => {
    const start = engine.indexOf("export async function invitePlayer");
    const end = engine.indexOf("export async function acceptInvite");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("cannot-invite-self");
    expect(body).toContain("not-friends");
    expect(body).toContain("player-busy");
    expect(body).toContain("areFriends");
    expect(body).toContain("hasLiveMatch");
    expect(body).toContain("onConflictDoUpdate");
    expect(body).toContain("setWhere");
  });
});

describe("acceptInvite", () => {
  it("claims an empty seat atomically and treats a live host as busy", () => {
    const start = engine.indexOf("export async function acceptInvite");
    const end = engine.indexOf("export async function declineInvite");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("hasLiveMatch");
    expect(body).toContain("isNull(matchSeats.userId)");
    expect(body).toContain('.for("update")');
    expect(body).toContain("notifyMatchRoomRetry");
  });
});

describe("startMatch", () => {
  it("starts the room before marking live and treats 409 as already started", () => {
    const start = engine.indexOf("export async function startMatch");
    const end = engine.indexOf("export async function completeMatch");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('type: "startMatch"');
    expect(body).toContain("error.status === 409");
    expect(body).toContain("error.status === 410");
    expect(body).toContain("error.status === 412");
    expect(body.indexOf('type: "startMatch"')).toBeLessThan(
      body.indexOf('status: "live"'),
    );
    expect(body).toContain('eq(matches.status, "lobby")');
    expect(body).toContain('.for("update")');
  });
});

describe("hostRemovePlayer", () => {
  it("lets the host withdraw a pending invite or unseat a guest in lobby", () => {
    const start = engine.indexOf("export async function hostRemovePlayer");
    const end = engine.indexOf("export async function leaveMatch");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("not-host");
    expect(body).toContain("not-pending");
    expect(body).toContain('type: "seatCleared"');
    expect(body).toContain('status: "declined"');
    expect(body.indexOf('type: "seatCleared"')).toBeLessThan(
      body.indexOf("userId: null"),
    );
  });
});

describe("leaveMatch", () => {
  it("refuses to unseat once the match row is no longer a lobby", () => {
    const start = engine.indexOf("export async function leaveMatch");
    const end = engine.indexOf("export async function getMatchLobby");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('.for("update")');
    expect(body).toContain('row.status !== "lobby"');
    expect(body.indexOf('type: "seatCleared"')).toBeLessThan(
      body.indexOf("userId: null"),
    );
  });
});

describe("getMatchHome", () => {
  it("hides expired incoming invites and other invites while a live match exists", () => {
    const start = engine.indexOf("export async function getMatchHome");
    const end = engine.indexOf("export async function getMatchSeat");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("gt(matches.lobbyExpiresAt");
    expect(body).toContain("incomingInvites: rejoin ? [] : incoming");
  });
});

describe("cancelMatchInternal", () => {
  it("tells the room before deleting the private row", () => {
    const start = engine.indexOf("async function cancelMatchInternal");
    const end = engine.indexOf("function hostRoleFromSeats");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body.indexOf('type: "cancel"')).toBeLessThan(body.indexOf("endLobby"));
  });
});

describe("completeMatch", () => {
  it("deletes private matches and only persists rounds for ranked", () => {
    const start = engine.indexOf("export async function completeMatch");
    const end = engine.indexOf("export async function expireMatch");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('existing.mode === "private"');
    expect(body).toContain("db.delete(matches)");
    expect(body).toContain("tx.insert(matchRounds)");
    expect(body.indexOf("db.delete(matches)")).toBeLessThan(
      body.indexOf("tx.insert(matchRounds)"),
    );
  });
});
