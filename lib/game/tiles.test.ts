import { describe, expect, it } from "vitest";

import { DEFAULT_MAP_TILES_URL, mapBaseImageUrl } from "@/lib/game/tiles";

describe("mapBaseImageUrl", () => {
  it("derives base.png beside the XYZ template", () => {
    expect(mapBaseImageUrl(DEFAULT_MAP_TILES_URL)).toBe("/maptex/base.png");
    expect(
      mapBaseImageUrl("https://cdn.example/maptex/{z}/{x}/{y}.png"),
    ).toBe("https://cdn.example/maptex/base.png");
  });
});
