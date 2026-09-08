import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { getPgError, PgCode } from "@/lib/db/errors";
import { stills } from "@/lib/db/schema/stills";
import { spRounds, spRuns } from "@/lib/db/schema/practice";
import {
  SP_ROUND_COUNT,
  SP_TIMED_ROUND_MS,
  type SpRunMode,
} from "@/lib/game/practice";
import { clampToMainField } from "@/lib/game/crs";
import { scoreGuess } from "@/lib/game/score";

import { toClosedRoundDto, toOpenRoundDto, toSummaryDto } from "./dto";
import { isFiniteGuess, submitDecision } from "./submit-decision";
import type { PlayDto, PracticeHomeDto } from "./types";

export class PracticeEngineError extends Error {
  constructor(
    readonly code:
      | "catalog-too-small"
      | "no-run"
      | "must-lock-in"
      | "invalid-guess",
  ) {
    super(code);
    this.name = "PracticeEngineError";
  }
}

type RoundWithStill = {
  id: string;
  roundIndex: number;
  guessX: number | null;
  guessZ: number | null;
  score: number | null;
  distanceMeters: number | null;
  lockedAt: Date | null;
  endsAt: Date | null;
  still: { imageUrl: string; x: number; z: number };
};

type RunWithRounds = {
  id: string;
  userId: string;
  mode: SpRunMode;
  currentRoundIndex: number;
  inSummary: boolean;
  rounds: RoundWithStill[];
};

const runWithRounds = {
  rounds: {
    with: { still: true as const },
    orderBy: [asc(spRounds.roundIndex)],
  },
};

async function loadRun(userId: string): Promise<RunWithRounds | null> {
  const run = await db.query.spRuns.findFirst({
    where: eq(spRuns.userId, userId),
    with: runWithRounds,
  });
  return run ?? null;
}

async function loadHealthyRun(userId: string): Promise<RunWithRounds | null> {
  const run = await loadRun(userId);
  if (!run) return null;
  if (run.rounds.some((row) => row.roundIndex === run.currentRoundIndex)) {
    return run;
  }
  await db.delete(spRuns).where(eq(spRuns.id, run.id));
  return null;
}

async function requireRun(userId: string): Promise<RunWithRounds> {
  const run = await loadHealthyRun(userId);
  if (!run) throw new PracticeEngineError("no-run");
  return run;
}

function currentRound(run: RunWithRounds): RoundWithStill {
  const round = run.rounds.find((row) => row.roundIndex === run.currentRoundIndex);
  if (!round) {
    throw new PracticeEngineError("no-run");
  }
  return round;
}

function guessPoint(round: RoundWithStill) {
  if (round.guessX === null || round.guessZ === null) return null;
  return { x: round.guessX, z: round.guessZ };
}

function scoredTotal(run: RunWithRounds): number {
  return run.rounds.reduce((sum, row) => sum + (row.score ?? 0), 0);
}

function toPlay(run: RunWithRounds, round: RoundWithStill): PlayDto {
  if (run.inSummary) {
    return toSummaryDto({
      runId: run.id,
      mode: run.mode,
      rounds: run.rounds.map((row) => ({
        roundIndex: row.roundIndex,
        score: row.score ?? 0,
        distanceMeters: row.distanceMeters,
      })),
    });
  }
  const total = scoredTotal(run);
  if (round.score !== null) {
    return toClosedRoundDto({
      runId: run.id,
      mode: run.mode,
      roundIndex: round.roundIndex,
      imageUrl: round.still.imageUrl,
      endsAt: round.endsAt,
      guess: guessPoint(round),
      truth: { x: round.still.x, z: round.still.z },
      distanceMeters: round.distanceMeters,
      score: round.score,
      total,
    });
  }
  return toOpenRoundDto({
    runId: run.id,
    mode: run.mode,
    roundIndex: round.roundIndex,
    imageUrl: round.still.imageUrl,
    endsAt: round.endsAt,
    total,
  });
}

async function scoreRoundZero(roundId: string) {
  const now = new Date();
  const [updated] = await db
    .update(spRounds)
    .set({
      score: 0,
      distanceMeters: null,
      guessX: null,
      guessZ: null,
      lockedAt: now,
    })
    .where(and(eq(spRounds.id, roundId), sql`${spRounds.score} is null`))
    .returning();
  return updated;
}

async function applyTimeoutIfNeeded(run: RunWithRounds): Promise<RunWithRounds> {
  const round = currentRound(run);
  if (run.inSummary || round.score !== null) return run;
  if (
    submitDecision({
      mode: run.mode,
      score: round.score,
      endsAt: round.endsAt,
      now: new Date(),
    }) !== "timeout-zero"
  ) {
    return run;
  }
  await scoreRoundZero(round.id);
  return requireRun(run.userId);
}

export async function getPracticeHome(userId: string): Promise<PracticeHomeDto> {
  const run = await loadHealthyRun(userId);
  if (!run) return { active: null };
  const withTimeout = await applyTimeoutIfNeeded(run);
  const round = currentRound(withTimeout);
  const play = toPlay(withTimeout, round);
  return {
    active: {
      mode: withTimeout.mode,
      roundIndex: withTimeout.currentRoundIndex,
      phase: play.phase,
    },
  };
}

export async function loadPractice(userId: string): Promise<PlayDto> {
  const withTimeout = await applyTimeoutIfNeeded(await requireRun(userId));
  return toPlay(withTimeout, currentRound(withTimeout));
}

export async function startPractice(
  userId: string,
  mode: SpRunMode,
): Promise<PlayDto> {
  const picked = await db
    .select({ id: stills.id })
    .from(stills)
    .orderBy(sql`random()`)
    .limit(SP_ROUND_COUNT);
  if (picked.length < SP_ROUND_COUNT) {
    throw new PracticeEngineError("catalog-too-small");
  }

  try {
    await createPracticeRun(userId, mode, picked);
  } catch (error) {
    if (getPgError(error).code !== PgCode.UniqueViolation) throw error;
    await createPracticeRun(userId, mode, picked);
  }

  const run = await requireRun(userId);
  return toPlay(run, currentRound(run));
}

async function createPracticeRun(
  userId: string,
  mode: SpRunMode,
  picked: { id: string }[],
) {
  await db.transaction(async (tx) => {
    await tx.delete(spRuns).where(eq(spRuns.userId, userId));
    const [created] = await tx
      .insert(spRuns)
      .values({
        userId,
        mode,
        currentRoundIndex: 1,
        inSummary: false,
      })
      .returning({ id: spRuns.id });
    if (!created) {
      throw new Error("Insert did not return a run.");
    }
    const endsAt =
      mode === "timed" ? new Date(Date.now() + SP_TIMED_ROUND_MS) : null;
    await tx.insert(spRounds).values(
      picked.map((still, index) => ({
        runId: created.id,
        roundIndex: index + 1,
        stillId: still.id,
        endsAt: index === 0 ? endsAt : null,
      })),
    );
  });
}

export async function submitPracticeGuess(
  userId: string,
  x: number,
  z: number,
): Promise<PlayDto> {
  if (!isFiniteGuess(x, z)) {
    throw new PracticeEngineError("invalid-guess");
  }
  const run = await requireRun(userId);
  if (run.inSummary) return toPlay(run, currentRound(run));

  const round = currentRound(run);
  const decision = submitDecision({
    mode: run.mode,
    score: round.score,
    endsAt: round.endsAt,
    now: new Date(),
  });

  if (decision === "already-scored") {
    return toPlay(run, round);
  }

  if (decision === "timeout-zero") {
    await scoreRoundZero(round.id);
    const reloaded = await requireRun(userId);
    return toPlay(reloaded, currentRound(reloaded));
  }

  const guess = clampToMainField({ x, z });
  const scored = scoreGuess(guess, { x: round.still.x, z: round.still.z });
  const now = new Date();
  await db
    .update(spRounds)
    .set({
      guessX: guess.x,
      guessZ: guess.z,
      score: scored.score,
      distanceMeters: scored.distanceMeters,
      lockedAt: now,
    })
    .where(and(eq(spRounds.id, round.id), sql`${spRounds.score} is null`));

  const reloaded = await requireRun(userId);
  return toPlay(reloaded, currentRound(reloaded));
}

export async function continuePractice(userId: string): Promise<PlayDto> {
  const run = await requireRun(userId);
  const scoredBefore = currentRound(run).score !== null;
  const withTimeout = await applyTimeoutIfNeeded(run);
  const round = currentRound(withTimeout);

  if (round.score === null) {
    throw new PracticeEngineError("must-lock-in");
  }
  if (!scoredBefore) {
    return toPlay(withTimeout, round);
  }
  if (withTimeout.inSummary) {
    return toPlay(withTimeout, round);
  }
  if (withTimeout.currentRoundIndex >= SP_ROUND_COUNT) {
    await db
      .update(spRuns)
      .set({ inSummary: true })
      .where(
        and(
          eq(spRuns.id, withTimeout.id),
          eq(spRuns.currentRoundIndex, SP_ROUND_COUNT),
          eq(spRuns.inSummary, false),
        ),
      );
    const reloaded = await requireRun(userId);
    return toPlay(reloaded, currentRound(reloaded));
  }

  const nextIndex = withTimeout.currentRoundIndex + 1;
  const nextEndsAt =
    withTimeout.mode === "timed"
      ? new Date(Date.now() + SP_TIMED_ROUND_MS)
      : null;
  await db.transaction(async (tx) => {
    const [moved] = await tx
      .update(spRuns)
      .set({ currentRoundIndex: nextIndex, inSummary: false })
      .where(
        and(
          eq(spRuns.id, withTimeout.id),
          eq(spRuns.currentRoundIndex, withTimeout.currentRoundIndex),
        ),
      )
      .returning({ id: spRuns.id });
    if (!moved || !nextEndsAt) return;
    await tx
      .update(spRounds)
      .set({ endsAt: nextEndsAt })
      .where(
        and(
          eq(spRounds.runId, withTimeout.id),
          eq(spRounds.roundIndex, nextIndex),
        ),
      );
  });

  const reloaded = await requireRun(userId);
  return toPlay(reloaded, currentRound(reloaded));
}

export async function abandonPractice(userId: string): Promise<void> {
  await db.delete(spRuns).where(eq(spRuns.userId, userId));
}

export async function finishPractice(userId: string): Promise<void> {
  await db
    .delete(spRuns)
    .where(and(eq(spRuns.userId, userId), eq(spRuns.inSummary, true)));
}
