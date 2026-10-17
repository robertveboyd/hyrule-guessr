import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("spectate private match path", () => {
  it("lets a third friend watch from lobby without taking a player seat", () => {
    const engine = read("lib/match/engine.ts");
    const accept = engine.slice(
      engine.indexOf("export async function acceptInvite"),
      engine.indexOf("export async function declineInvite"),
    );
    expect(accept).toContain('invite.kind === "spectator"');
    expect(accept.indexOf('invite.kind === "spectator"')).toBeLessThan(
      accept.indexOf("isNull(matchSeats.userId)"),
    );
    expect(accept).toContain("return toLobbyDto(userId, matchId)");
    const play = read("components/match/match-play.tsx");
    expect(play).toContain("MatchWatch");
    expect(read("components/match/match-watch.tsx")).not.toContain("onLockIn");
    expect(read("components/match/match-watch.tsx")).toContain("WatchMap");
  });

  it("fans a player's mapMoved to watchers and keeps it off the opponent snapshot", () => {
    const room = read("party/match-room.ts");
    expect(room).toContain("broadcastWatchers");
    expect(room).toContain("joinRoleSeesViewports(role)");
    const snapshot = room.slice(
      room.indexOf("private snapshotFor"),
      room.indexOf("private async broadcastSnapshots"),
    );
    expect(snapshot).toContain("viewA");
    expect(read("components/match/match-play.tsx")).toContain("onViewChange");
    expect(read("components/match/match-play.tsx")).toContain("onMapMoved");
    const leaflet = read("components/map/botw-leaflet.tsx");
    expect(leaflet).toContain('map.on("move"');
    expect(leaflet).toContain("MATCH_MAP_MOVED_MIN_MS");
    expect(leaflet).toContain("emitView(false)");
    expect(leaflet).toContain("emitView(true)");
  });

  it("sends a late spectator the current snapshot without claiming a seat", () => {
    const connect = read("party/match-room.ts");
    const body = connect.slice(
      connect.indexOf("async onConnect"),
      connect.indexOf("getConnectionTags"),
    );
    expect(body).toContain('claims.role === "spectator"');
    expect(body).toContain('sendSnapshot(connection, state, "spectator")');
    expect(body).toContain("MATCH_ROOM_CLOSE_SPECTATORS_FULL");
    expect(body).toContain("playerA.userId === claims.userId");
  });

  it("shows recap to watchers and does not cancel the match when they go home", () => {
    const play = read("components/match/match-play.tsx");
    expect(play).toContain("matchRecap({");
    expect(play.indexOf("matchRecap({")).toBeLessThan(play.indexOf("<MatchWatch"));
    expect(play).toContain('snapshot.phase === "over"');
    const menu = read("components/match/match-menu.tsx");
    expect(menu).toContain("Leave (rejoin later)");
    expect(menu).not.toContain("leaveMatch");
  });
});
