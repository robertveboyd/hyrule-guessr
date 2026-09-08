"use server";

import { requireExclusiveSession } from "@/lib/auth/check-exclusive-session";
import { isSpRunMode, type SpRunMode } from "@/lib/game/practice";

import {
  abandonPractice,
  continuePractice,
  finishPractice,
  getPracticeHome,
  loadPractice,
  PracticeEngineError,
  startPractice,
  submitPracticeGuess,
} from "./engine";
import type { PlayDto, PracticeErrorCode, PracticeHomeDto } from "./types";

export type { PracticeErrorCode };

export type PracticeActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PracticeErrorCode };

async function withExclusive<T>(
  clientSessionId: string | null,
  fn: (userId: string) => Promise<T>,
): Promise<PracticeActionResult<T>> {
  const exclusive = await requireExclusiveSession(clientSessionId);
  if (!exclusive) return { ok: false, code: "forbidden" };
  try {
    return { ok: true, data: await fn(exclusive.id) };
  } catch (error) {
    if (error instanceof PracticeEngineError) {
      return { ok: false, code: error.code };
    }
    throw error;
  }
}

function parseMode(mode: string): SpRunMode | null {
  return isSpRunMode(mode) ? mode : null;
}

export async function loadPracticeHomeAction(
  clientSessionId: string | null,
): Promise<PracticeActionResult<PracticeHomeDto>> {
  return withExclusive(clientSessionId, getPracticeHome);
}

export async function loadPracticeAction(
  clientSessionId: string | null,
): Promise<PracticeActionResult<PlayDto>> {
  return withExclusive(clientSessionId, loadPractice);
}

export async function startPracticeAction(
  clientSessionId: string | null,
  mode: string,
): Promise<PracticeActionResult<PlayDto>> {
  const parsed = parseMode(mode);
  if (!parsed) return { ok: false, code: "invalid-mode" };
  return withExclusive(clientSessionId, (userId) => startPractice(userId, parsed));
}

export async function submitPracticeGuessAction(
  clientSessionId: string | null,
  x: number,
  z: number,
): Promise<PracticeActionResult<PlayDto>> {
  return withExclusive(clientSessionId, (userId) =>
    submitPracticeGuess(userId, x, z),
  );
}

export async function continuePracticeAction(
  clientSessionId: string | null,
): Promise<PracticeActionResult<PlayDto>> {
  return withExclusive(clientSessionId, continuePractice);
}

export async function abandonPracticeAction(
  clientSessionId: string | null,
): Promise<PracticeActionResult<null>> {
  return withExclusive(clientSessionId, async (userId) => {
    await abandonPractice(userId);
    return null;
  });
}

export async function finishPracticeAction(
  clientSessionId: string | null,
): Promise<PracticeActionResult<null>> {
  return withExclusive(clientSessionId, async (userId) => {
    await finishPractice(userId);
    return null;
  });
}
