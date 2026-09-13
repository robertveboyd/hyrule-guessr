import {
  MATCH_MULTIPLIER_STEP,
  MATCH_START_HEALTH,
  MATCH_START_MULTIPLIER,
} from "./match";

export function roundDamage(
  scoreA: number,
  scoreB: number,
  multiplierA: number,
  multiplierB: number,
): { damage: number; loser: "a" | "b" | null; damageMultiplier: number } {
  if (scoreA === scoreB) {
    return { damage: 0, loser: null, damageMultiplier: 0 };
  }
  const winnerIsA = scoreA > scoreB;
  const damageMultiplier = winnerIsA ? multiplierA : multiplierB;
  const damage = Math.round(Math.abs(scoreA - scoreB) * damageMultiplier);
  return { damage, loser: winnerIsA ? "b" : "a", damageMultiplier };
}

export function nextMultipliers(input: {
  multiplierA: number;
  multiplierB: number;
  loser: "a" | "b" | null;
}): { multiplierA: number; multiplierB: number } {
  if (input.loser === null) {
    return {
      multiplierA: input.multiplierA + MATCH_MULTIPLIER_STEP,
      multiplierB: input.multiplierB + MATCH_MULTIPLIER_STEP,
    };
  }
  if (input.loser === "a") {
    return {
      multiplierA: input.multiplierA,
      multiplierB: input.multiplierB + MATCH_MULTIPLIER_STEP,
    };
  }
  return {
    multiplierA: input.multiplierA + MATCH_MULTIPLIER_STEP,
    multiplierB: input.multiplierB,
  };
}

export function applyRoundDamage(input: {
  healthA: number;
  healthB: number;
  scoreA: number;
  scoreB: number;
  multiplierA: number;
  multiplierB: number;
}): {
  healthA: number;
  healthB: number;
  damage: number;
  loser: "a" | "b" | null;
  ko: boolean;
  damageMultiplier: number;
  multiplierA: number;
  multiplierB: number;
} {
  const { damage, loser, damageMultiplier } = roundDamage(
    input.scoreA,
    input.scoreB,
    input.multiplierA,
    input.multiplierB,
  );
  let healthA = input.healthA;
  let healthB = input.healthB;
  if (loser === "a") healthA = Math.max(0, healthA - damage);
  if (loser === "b") healthB = Math.max(0, healthB - damage);
  const next = nextMultipliers({
    multiplierA: input.multiplierA,
    multiplierB: input.multiplierB,
    loser,
  });
  return {
    healthA,
    healthB,
    damage,
    loser,
    ko: healthA === 0 || healthB === 0,
    damageMultiplier,
    multiplierA: next.multiplierA,
    multiplierB: next.multiplierB,
  };
}

export function matchOutcome(input: {
  healthA: number;
  healthB: number;
  playerAId: string;
  playerBId: string;
  lastScheduledRound: boolean;
  ko: boolean;
}): { winnerUserId: string | null; over: boolean } {
  if (input.ko) {
    if (input.healthA === 0 && input.healthB === 0) {
      return { winnerUserId: null, over: true };
    }
    return {
      winnerUserId: input.healthA === 0 ? input.playerBId : input.playerAId,
      over: true,
    };
  }
  if (!input.lastScheduledRound) {
    return { winnerUserId: null, over: false };
  }
  if (input.healthA === input.healthB) {
    return { winnerUserId: null, over: true };
  }
  return {
    winnerUserId: input.healthA > input.healthB ? input.playerAId : input.playerBId,
    over: true,
  };
}

export function startingHealth(): number {
  return MATCH_START_HEALTH;
}

export function startingMultiplier(): number {
  return MATCH_START_MULTIPLIER;
}
