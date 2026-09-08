import { SP_LOCK_IN_GRACE_MS, type SpRunMode } from "@/lib/game/practice";

export type SubmitDecision = "already-scored" | "accept" | "timeout-zero";

export function submitDecision(input: {
  mode: SpRunMode;
  score: number | null;
  endsAt: Date | null;
  now: Date;
  graceMs?: number;
}): SubmitDecision {
  if (input.score !== null) return "already-scored";
  if (input.mode === "casual") return "accept";
  const endsAt = input.endsAt;
  if (!endsAt) return "timeout-zero";
  const graceMs = input.graceMs ?? SP_LOCK_IN_GRACE_MS;
  if (input.now.getTime() <= endsAt.getTime() + graceMs) return "accept";
  return "timeout-zero";
}

export function isFiniteGuess(x: number, z: number): boolean {
  return (
    typeof x === "number" &&
    typeof z === "number" &&
    Number.isFinite(x) &&
    Number.isFinite(z)
  );
}
