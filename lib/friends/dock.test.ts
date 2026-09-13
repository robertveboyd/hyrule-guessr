import { describe, expect, it } from "vitest";

import { hideFriendsDock } from "./dock";

describe("hideFriendsDock", () => {
  it("hides on play, map, friends, and match", () => {
    expect(hideFriendsDock("/play")).toBe(true);
    expect(hideFriendsDock("/map")).toBe(true);
    expect(hideFriendsDock("/friends")).toBe(true);
    expect(hideFriendsDock("/match/11111111-1111-4111-8111-111111111111")).toBe(
      true,
    );
    expect(hideFriendsDock("/")).toBe(false);
  });
});
