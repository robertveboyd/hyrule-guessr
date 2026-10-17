import { describe, expect, it } from "vitest";

import {
  MATCH_SPECTATOR_CAP,
  joinRoleSeesViewports,
  rankedRejectsSpectator,
  spectatorSlotsOpen,
} from "./match";

describe("spectator join rules", () => {
  it("caps extra spectators at 20 and lets a reconnecting watcher in", () => {
    expect(spectatorSlotsOpen(MATCH_SPECTATOR_CAP, false)).toBe(false);
    expect(spectatorSlotsOpen(MATCH_SPECTATOR_CAP - 1, false)).toBe(true);
    expect(spectatorSlotsOpen(MATCH_SPECTATOR_CAP, true)).toBe(true);
  });

  it("shows viewports to watchers only and rejects ranked spectator tags", () => {
    expect(joinRoleSeesViewports("spectator")).toBe(true);
    expect(joinRoleSeesViewports("host_observer")).toBe(true);
    expect(joinRoleSeesViewports("player_a")).toBe(false);
    expect(rankedRejectsSpectator("ranked", "spectator")).toBe(true);
    expect(rankedRejectsSpectator("private", "spectator")).toBe(false);
    expect(rankedRejectsSpectator("ranked", "player_a")).toBe(false);
  });
});
