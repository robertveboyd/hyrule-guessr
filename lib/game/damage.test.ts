import { describe, expect, it } from "vitest";

import {
  applyRoundDamage,
  matchOutcome,
  nextMultipliers,
  roundDamage,
} from "./damage";
import { MATCH_START_HEALTH } from "./match";

describe("roundDamage", () => {
  it("is 0 when scores are equal", () => {
    expect(roundDamage(4000, 4000, 1, 1.5)).toEqual({
      damage: 0,
      loser: null,
      damageMultiplier: 0,
    });
  });

  it("uses the winner's multiplier, not the round number", () => {
    expect(roundDamage(5000, 4000, 1, 1)).toEqual({
      damage: 1000,
      loser: "b",
      damageMultiplier: 1,
    });
    expect(roundDamage(4000, 5000, 1, 1.5)).toEqual({
      damage: 1500,
      loser: "a",
      damageMultiplier: 1.5,
    });
  });
});

describe("nextMultipliers", () => {
  it("gives +0.5x to the round winner only", () => {
    expect(
      nextMultipliers({ multiplierA: 1, multiplierB: 1, loser: "b" }),
    ).toEqual({ multiplierA: 1.5, multiplierB: 1 });
  });

  it("gives +0.5x to both players on a score tie", () => {
    expect(
      nextMultipliers({ multiplierA: 1.5, multiplierB: 1, loser: null }),
    ).toEqual({ multiplierA: 2, multiplierB: 1.5 });
  });
});

describe("applyRoundDamage", () => {
  it("clamps health at 0, reports KO, and bumps the winner's multiplier", () => {
    const result = applyRoundDamage({
      healthA: 500,
      healthB: MATCH_START_HEALTH,
      scoreA: 0,
      scoreB: 5000,
      multiplierA: 1,
      multiplierB: 1,
    });
    expect(result.healthA).toBe(0);
    expect(result.healthB).toBe(MATCH_START_HEALTH);
    expect(result.ko).toBe(true);
    expect(result.loser).toBe("a");
    expect(result.damageMultiplier).toBe(1);
    expect(result.multiplierA).toBe(1);
    expect(result.multiplierB).toBe(1.5);
  });
});

describe("matchOutcome", () => {
  const playerAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const playerBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("ends on KO with the surviving player as winner", () => {
    expect(
      matchOutcome({
        healthA: 0,
        healthB: 4000,
        playerAId,
        playerBId,
        lastScheduledRound: false,
        ko: true,
      }),
    ).toEqual({ winnerUserId: playerBId, over: true });
  });

  it("compares health after the last round when nobody is KO", () => {
    expect(
      matchOutcome({
        healthA: 3000,
        healthB: 2000,
        playerAId,
        playerBId,
        lastScheduledRound: true,
        ko: false,
      }),
    ).toEqual({ winnerUserId: playerAId, over: true });
    expect(
      matchOutcome({
        healthA: 2000,
        healthB: 2000,
        playerAId,
        playerBId,
        lastScheduledRound: true,
        ko: false,
      }),
    ).toEqual({ winnerUserId: null, over: true });
  });

  it("continues when it is not the last round and nobody is KO", () => {
    expect(
      matchOutcome({
        healthA: 5000,
        healthB: 4000,
        playerAId,
        playerBId,
        lastScheduledRound: false,
        ko: false,
      }),
    ).toEqual({ winnerUserId: null, over: false });
  });
});
