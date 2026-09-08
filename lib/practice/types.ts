import type { SpRunMode } from "@/lib/game/practice";

export type PracticeErrorCode =
  | "forbidden"
  | "catalog-too-small"
  | "no-run"
  | "must-lock-in"
  | "invalid-guess"
  | "invalid-mode";

export type GamePointDto = { x: number; z: number };

export type OpenRoundDto = {
  phase: "guessing";
  runId: string;
  mode: SpRunMode;
  roundIndex: number;
  roundCount: number;
  imageUrl: string;
  endsAt: string | null;
  total: number;
};

export type ClosedRoundDto = {
  phase: "reveal";
  runId: string;
  mode: SpRunMode;
  roundIndex: number;
  roundCount: number;
  imageUrl: string;
  endsAt: string | null;
  guess: GamePointDto | null;
  truth: GamePointDto;
  distanceMeters: number | null;
  score: number;
  total: number;
};

export type SummaryRoundDto = {
  roundIndex: number;
  score: number;
  distanceMeters: number | null;
};

export type SummaryDto = {
  phase: "summary";
  runId: string;
  mode: SpRunMode;
  rounds: SummaryRoundDto[];
  total: number;
  totalMax: number;
};

export type PlayDto = OpenRoundDto | ClosedRoundDto | SummaryDto;

export type PracticeHomeDto = {
  active: {
    mode: SpRunMode;
    roundIndex: number;
    phase: PlayDto["phase"];
  } | null;
};
