import { describe, expect, it } from "vitest";

import {
  SCORE_MAX,
  SCORE_PERFECT_METERS,
  SCORE_TAU_METERS,
  scoreFromDistance,
  scoreGuess,
} from "./score";

function expectedScore(excessMeters: number) {
  return Math.round(SCORE_MAX * Math.exp(-excessMeters / SCORE_TAU_METERS));
}

describe("scoreFromDistance", () => {
  it("is 5000 at distance 0", () => {
    expect(scoreFromDistance(0)).toBe(SCORE_MAX);
  });

  it("is 5000 through the 10 m perfect radius, including 1 m", () => {
    expect(scoreFromDistance(1)).toBe(SCORE_MAX);
    expect(scoreFromDistance(SCORE_PERFECT_METERS)).toBe(SCORE_MAX);
  });

  it("starts decay after 10 m, so 11 m is 4998", () => {
    expect(scoreFromDistance(11)).toBe(expectedScore(1));
    expect(scoreFromDistance(11)).toBe(4998);
  });

  it("matches 5000 * e^(-1) at 10 m + τ", () => {
    expect(scoreFromDistance(SCORE_PERFECT_METERS + SCORE_TAU_METERS)).toBe(
      Math.round(SCORE_MAX * Math.exp(-1)),
    );
  });

  it("is near 0 for a far miss and 0 for an extreme miss", () => {
    expect(scoreFromDistance(20_000)).toBeLessThan(50);
    expect(scoreFromDistance(100_000)).toBe(0);
  });

  it("clamps above 5000 if distance is negative", () => {
    expect(scoreFromDistance(-1)).toBe(SCORE_MAX);
  });

  it("is 0 for non-finite distance", () => {
    expect(scoreFromDistance(Number.NaN)).toBe(0);
    expect(scoreFromDistance(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("scoreGuess", () => {
  const kakariko = { x: 1831, z: 995.5 };

  it("scores a perfect pin 5000 with 0 m", () => {
    expect(scoreGuess(kakariko, kakariko)).toEqual({
      distance: 0,
      distanceMeters: 0,
      score: SCORE_MAX,
    });
  });

  it("scores a 1 m miss 5000", () => {
    const nearby = { x: kakariko.x + 1, z: kakariko.z };
    expect(scoreGuess(nearby, kakariko)).toEqual({
      distance: 1,
      distanceMeters: 1,
      score: SCORE_MAX,
    });
  });

  it("rounds displayed meters and still scores a nearby hill well", () => {
    const nearby = { x: kakariko.x + 80, z: kakariko.z };
    const result = scoreGuess(nearby, kakariko);
    expect(result.distanceMeters).toBe(80);
    expect(result.score).toBeGreaterThan(4000);
    expect(result.score).toBeLessThan(SCORE_MAX);
  });
});
