import { distanceMeters, type GamePoint } from "./crs";

/** Max points for one round. */
export const SCORE_MAX = 5000;

/**
 * Length scale in game meters. Decay is `e^(-d' / τ)` with
 * `d' = max(0, d − 10)`. 2000 m is the 1/e distance past the perfect radius.
 */
export const SCORE_TAU_METERS = 2000;

/**
 * Perfect-score radius. Decay uses `max(0, d − 10)`, so 10 m is still 5000
 * and the exponential starts from there instead of from 0.
 */
export const SCORE_PERFECT_METERS = 10;

/**
 * Exponential decay on Euclidean `(x, z)` distance, then round and clamp.
 *
 * `clamp(round(5000 * e^(-max(0, d − 10) / τ)), 0, 5000)` with τ = 2000.
 */
export function scoreFromDistance(distanceMetersValue: number): number {
  if (!Number.isFinite(distanceMetersValue)) {
    return 0;
  }
  const d = Math.max(0, distanceMetersValue);
  const excess = Math.max(0, d - SCORE_PERFECT_METERS);
  const raw = SCORE_MAX * Math.exp(-excess / SCORE_TAU_METERS);
  return Math.min(SCORE_MAX, Math.max(0, Math.round(raw)));
}

export function scoreGuess(
  guess: GamePoint,
  truth: GamePoint,
): { distance: number; distanceMeters: number; score: number } {
  const distance = distanceMeters(guess, truth);
  return {
    distance,
    distanceMeters: Math.round(distance),
    score: scoreFromDistance(distance),
  };
}
