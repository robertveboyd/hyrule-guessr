import { describe, expect, it } from "vitest";

import { hideFriendsDock } from "./dock";

describe("hideFriendsDock", () => {
  it("hides on play and map only", () => {
    expect(hideFriendsDock("/play")).toBe(true);
    expect(hideFriendsDock("/map")).toBe(true);
    expect(hideFriendsDock("/")).toBe(false);
    expect(hideFriendsDock("/friends")).toBe(false);
  });
});
