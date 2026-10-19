import { describe, expect, it } from "vitest";

import { pinArt, pinLineColor } from "@/components/map/pin-icons";

describe("pinArt", () => {
  it("uses the red flared beacon for you, practice, and preview", () => {
    const art = pinArt("guess");
    expect(art.src).toBe("/kit/map-pin-red.svg?v=4");
    expect(pinArt("preview").src).toBe("/kit/map-pin-red.svg?v=4");
    expect(art.iconSize).toEqual([42, 141]);
    expect(art.iconAnchor).toEqual([21, 120]);
  });

  it("uses the blue beacon for the opponent", () => {
    expect(pinArt("opponent").src).toBe("/kit/map-pin-blue.svg?v=4");
  });

  it("uses the kit quest marker for the truth pin, anchored at the ring center", () => {
    const art = pinArt("truth");
    expect(art.src).toBe("/kit/map-quest.svg");
    expect(art.iconSize).toEqual([48, 48]);
    expect(art.iconAnchor).toEqual([24, 24]);
  });
});

describe("pinLineColor", () => {
  it("matches beacon colors on reveal lines", () => {
    expect(pinLineColor("guess")).toBe("#FF8964");
    expect(pinLineColor("opponent")).toBe("#9DAAFE");
  });
});
