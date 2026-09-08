import { describe, expect, it } from "vitest";

import { isFiniteGuess, submitDecision } from "./submit-decision";

const endsAt = new Date("2026-09-06T12:00:00.000Z");

describe("submitDecision", () => {
  it("returns the existing result if the round is already scored", () => {
    expect(
      submitDecision({
        mode: "timed",
        score: 1200,
        endsAt,
        now: new Date(endsAt.getTime() + 60_000),
      }),
    ).toBe("already-scored");
  });

  it("accepts a casual lock-in with no clock", () => {
    expect(
      submitDecision({
        mode: "casual",
        score: null,
        endsAt: null,
        now: new Date(),
      }),
    ).toBe("accept");
  });

  it("accepts a timed lock-in on the deadline and during the 1s grace", () => {
    expect(
      submitDecision({
        mode: "timed",
        score: null,
        endsAt,
        now: endsAt,
      }),
    ).toBe("accept");
    expect(
      submitDecision({
        mode: "timed",
        score: null,
        endsAt,
        now: new Date(endsAt.getTime() + 1000),
      }),
    ).toBe("accept");
  });

  it("times out a timed round with no endsAt", () => {
    expect(
      submitDecision({
        mode: "timed",
        score: null,
        endsAt: null,
        now: new Date(),
      }),
    ).toBe("timeout-zero");
  });

  it("times out a late timed lock-in with no prior pin", () => {
    expect(
      submitDecision({
        mode: "timed",
        score: null,
        endsAt,
        now: new Date(endsAt.getTime() + 1001),
      }),
    ).toBe("timeout-zero");
  });
});

describe("isFiniteGuess", () => {
  it("rejects NaN, Infinity, and non-numbers", () => {
    expect(isFiniteGuess(1, Number.NaN)).toBe(false);
    expect(isFiniteGuess(Number.POSITIVE_INFINITY, 1)).toBe(false);
    expect(isFiniteGuess(-1023, 1796)).toBe(true);
    expect(isFiniteGuess("1" as unknown as number, 1)).toBe(false);
    expect(isFiniteGuess(1, null as unknown as number)).toBe(false);
  });
});
