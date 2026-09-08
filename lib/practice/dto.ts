import { SP_ROUND_COUNT, SP_SCORE_TOTAL_MAX, type SpRunMode } from "@/lib/game/practice";

import type {
  ClosedRoundDto,
  OpenRoundDto,
  PlayDto,
  SummaryDto,
} from "./types";

export function toOpenRoundDto(input: {
  runId: string;
  mode: SpRunMode;
  roundIndex: number;
  imageUrl: string;
  endsAt: Date | null;
  total: number;
}): OpenRoundDto {
  return {
    phase: "guessing",
    runId: input.runId,
    mode: input.mode,
    roundIndex: input.roundIndex,
    roundCount: SP_ROUND_COUNT,
    imageUrl: input.imageUrl,
    endsAt: input.endsAt?.toISOString() ?? null,
    total: input.total,
  };
}

export function toClosedRoundDto(input: {
  runId: string;
  mode: SpRunMode;
  roundIndex: number;
  imageUrl: string;
  endsAt: Date | null;
  guess: { x: number; z: number } | null;
  truth: { x: number; z: number };
  distanceMeters: number | null;
  score: number;
  total: number;
}): ClosedRoundDto {
  return {
    phase: "reveal",
    runId: input.runId,
    mode: input.mode,
    roundIndex: input.roundIndex,
    roundCount: SP_ROUND_COUNT,
    imageUrl: input.imageUrl,
    endsAt: input.endsAt?.toISOString() ?? null,
    guess: input.guess,
    truth: input.truth,
    distanceMeters: input.distanceMeters,
    score: input.score,
    total: input.total,
  };
}

export function toSummaryDto(input: {
  runId: string;
  mode: SpRunMode;
  rounds: { roundIndex: number; score: number; distanceMeters: number | null }[];
}): SummaryDto {
  return {
    phase: "summary",
    runId: input.runId,
    mode: input.mode,
    rounds: input.rounds,
    total: input.rounds.reduce((sum, round) => sum + round.score, 0),
    totalMax: SP_SCORE_TOTAL_MAX,
  };
}

export function playHasCoordinates(play: PlayDto): boolean {
  return play.phase === "reveal";
}
