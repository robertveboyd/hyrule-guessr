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

  it("extends waiting players' timers to a pending reconnect window", () => {
    const start = room.indexOf("private snapshotEndsAt");
    const end = room.indexOf("private snapshotFor");
    const body = room.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("disconnectUntil");
    expect(body).toContain("lockInOpen");
  });
});
