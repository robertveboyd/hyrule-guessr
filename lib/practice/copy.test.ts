import { describe, expect, it } from "vitest";

import { mapEnlargeHint, timedMissHint } from "./copy";

describe("timedMissHint", () => {
  it("names a timed miss and stays quiet otherwise", () => {
    expect(timedMissHint({ mode: "timed", distanceMeters: null })).toBe(
      "Time's up. Missed rounds score 0.",
    );
    expect(timedMissHint({ mode: "timed", distanceMeters: 12 })).toBeNull();
    expect(timedMissHint({ mode: "casual", distanceMeters: null })).toBeNull();
  });
});

describe("mapEnlargeHint", () => {
  it("labels keyboard vs touch enlarge", () => {
    expect(mapEnlargeHint(true)).toBe("M to enlarge");
    expect(mapEnlargeHint(false)).toBe("Tap to enlarge");
  });
});
