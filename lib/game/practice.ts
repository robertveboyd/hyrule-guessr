import { SCORE_MAX } from "./score";

/** Single-player practice constants. Scoring formula lives in `score.ts`. */

export const SP_ROUND_COUNT = 5;
export const SP_SCORE_TOTAL_MAX = SP_ROUND_COUNT * SCORE_MAX;
export const SP_TIMED_ROUND_MS = 60_000;
export const SP_LOCK_IN_GRACE_MS = 1_000;

export const SP_RUN_MODES = ["casual", "timed"] as const;
export type SpRunMode = (typeof SP_RUN_MODES)[number];

export function isSpRunMode(value: unknown): value is SpRunMode {
  return SP_RUN_MODES.includes(value as SpRunMode);
}
