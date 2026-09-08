import { describe, expect, it } from "vitest";

import { playHasCoordinates, toClosedRoundDto, toOpenRoundDto, toSummaryDto } from "./dto";

describe("toOpenRoundDto", () => {
  it("does not include true coordinates", () => {
    const dto = toOpenRoundDto({
      runId: "run",
      mode: "casual",
      roundIndex: 1,
      imageUrl: "/catalog/00001.jpg",
      endsAt: null,
      total: 0,
    });
    expect(dto.phase).toBe("guessing");
    expect(dto.total).toBe(0);
    expect(dto).not.toHaveProperty("truth");
    expect(dto).not.toHaveProperty("x");
    expect(dto).not.toHaveProperty("z");
    expect(playHasCoordinates(dto)).toBe(false);
    expect(Object.keys(dto).sort()).toEqual([
      "endsAt",
      "imageUrl",
      "mode",
      "phase",
      "roundCount",
      "roundIndex",
      "runId",
      "total",
    ]);
    expect(JSON.stringify(dto)).not.toMatch(/-1023/);
  });
});

describe("toClosedRoundDto", () => {
  it("includes this round's score and the running total", () => {
    const dto = toClosedRoundDto({
      runId: "run",
      mode: "casual",
      roundIndex: 2,
      imageUrl: "/catalog/00001.jpg",
      endsAt: null,
      guess: { x: 1, z: 2 },
      truth: { x: -1023, z: 1796 },
      distanceMeters: 80,
      score: 4200,
      total: 9200,
    });
    expect(dto.phase).toBe("reveal");
    expect(dto.score).toBe(4200);
    expect(dto.total).toBe(9200);
    expect(playHasCoordinates(dto)).toBe(true);
  });
});

describe("toSummaryDto", () => {
  it("totals per-round scores against 25000", () => {
    const dto = toSummaryDto({
      runId: "run",
      mode: "timed",
      rounds: [
        { roundIndex: 1, score: 5000, distanceMeters: 0 },
        { roundIndex: 2, score: 0, distanceMeters: null },
        { roundIndex: 3, score: 1000, distanceMeters: 3000 },
        { roundIndex: 4, score: 2000, distanceMeters: 1800 },
        { roundIndex: 5, score: 2500, distanceMeters: 1400 },
      ],
    });
    expect(dto.total).toBe(10500);
    expect(dto.totalMax).toBe(25000);
    expect(dto).not.toHaveProperty("truth");
    expect(playHasCoordinates(dto)).toBe(false);
  });
});
