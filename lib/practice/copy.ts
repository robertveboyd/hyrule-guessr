import type { SpRunMode } from "@/lib/game/practice";

export function timedMissHint(input: {
  mode: SpRunMode;
  distanceMeters: number | null;
}): string | null {
  if (input.mode !== "timed" || input.distanceMeters !== null) return null;
  return "Time's up. Missed rounds score 0.";
}

export function mapEnlargeHint(finePointer: boolean): string {
  return finePointer ? "M to enlarge" : "Tap to enlarge";
}
