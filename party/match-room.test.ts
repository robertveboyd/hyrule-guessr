import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const room = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "match-room.ts"),
  "utf8",
);

describe("MatchRoom terminal order", () => {
  it("broadcasts over before deleting the private row", () => {
    const start = room.indexOf("private async finishMatch");
    const end = room.indexOf("private async persistComplete");
    const body = room.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body.indexOf("broadcastSnapshots")).toBeLessThan(
      body.indexOf("persistComplete"),
    );
  });

  it("broadcasts cancelled before expiring the lobby row", () => {
    const cancelled = room.indexOf('if (state.phase === "cancelled")');
    const start = room.indexOf('if (state.phase === "lobby")', cancelled);
    const end = room.indexOf("this.applyDisconnectTimeouts");
    const body = room.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body.indexOf("broadcastSnapshots")).toBeLessThan(
      body.indexOf("expireOnNext"),
    );
  });

  it("scores an uncommitted pin when the round timer expires", () => {
    expect(room).toContain(
      "this.lockWithUncommittedPin(state.playerA, views.viewA?.pin)",
    );
    expect(room).toContain(
      "this.lockWithUncommittedPin(state.playerB, views.viewB?.pin)",
    );
    const helper = room.slice(
      room.indexOf("private lockWithUncommittedPin"),
      room.indexOf("private applyDisconnectTimeouts"),
    );
    expect(helper).toContain("seat.guess = pin");
    expect(helper).toContain("pin ? { x: pin.x, z: pin.z } : null");
  });

  it("extends waiting players' timers to a pending reconnect window", () => {
    const start = room.indexOf("private snapshotEndsAt");
    const end = room.indexOf("private async applyMapMoved");
    const body = room.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("disconnectUntil");
    expect(body).toContain("lockInOpen");
  });
});

describe("MatchRoom spectators", () => {
  it("rejects ranked watchers, caps extra sockets, and fans mapMoved to watchers only", () => {
    expect(room).toContain("rankedRejectsSpectator");
    expect(room).toContain("spectatorSlotsOpen");
    expect(room).toContain("MATCH_ROOM_CLOSE_SPECTATORS_FULL");
    expect(room).toContain("joinRoleSeesViewports");
    expect(room).toContain("broadcastWatchers");
    expect(room).toContain("MATCH_MAP_MOVED_MIN_MS");
    expect(room).toContain("VIEWPORTS_KEY");
    const apply = room.slice(
      room.indexOf("private async applyMapMoved"),
      room.indexOf("private snapshotFor"),
    );
    expect(apply).toContain("saveViewports");
    expect(apply).not.toContain("saveState");
    expect(apply).toContain("pinChanged");
    expect(room).toContain("stampViewportPin");
    const mapMoved = room.indexOf('if (inbound.type === "mapMoved")');
    const lockIn = room.indexOf("if (conn.role !== \"player_a\" && conn.role !== \"player_b\")");
    expect(mapMoved).toBeGreaterThan(-1);
    expect(lockIn).toBeGreaterThan(-1);
    const snapshot = room.slice(
      room.indexOf("private snapshotFor"),
      room.indexOf("private async broadcastSnapshots"),
    );
    expect(snapshot).toContain("joinRoleSeesViewports(role)");
    expect(snapshot).toContain("viewA");
    expect(snapshot).toContain("viewB");
  });

  it("does not claim a player seat for a spectator socket", () => {
    const connect = room.slice(
      room.indexOf("async onConnect"),
      room.indexOf("getConnectionTags"),
    );
    expect(connect).toContain('claims.role === "spectator"');
    expect(connect.indexOf("seat.userId = claims.userId")).toBeGreaterThan(
      connect.indexOf('claims.role === "spectator"'),
    );
    expect(connect).toContain("playerA.userId === claims.userId");
  });
});
