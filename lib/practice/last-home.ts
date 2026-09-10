import { readSessionId } from "@/lib/auth/session-storage";
import { isSpRunMode } from "@/lib/game/practice";
import type { PlayDto, PracticeHomeDto } from "./types";

export const LAST_PRACTICE_HOME_KEY = "hyrule-guessr.home";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeLastPracticeHome(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const PLAY_PHASES: readonly PlayDto["phase"][] = [
  "guessing",
  "reveal",
  "summary",
];

function isPlayPhase(value: unknown): value is PlayDto["phase"] {
  return PLAY_PHASES.includes(value as PlayDto["phase"]);
}

const IDLE_HOME: PracticeHomeDto = { active: null };

export function parsePracticeHomeDto(value: unknown): PracticeHomeDto | null {
  if (!value || typeof value !== "object") return null;
  const active = (value as { active?: unknown }).active;
  if (active === null) return IDLE_HOME;
  if (!active || typeof active !== "object") return null;
  const row = active as {
    mode?: unknown;
    roundIndex?: unknown;
    phase?: unknown;
  };
  if (!isSpRunMode(row.mode)) return null;
  if (
    typeof row.roundIndex !== "number" ||
    !Number.isInteger(row.roundIndex) ||
    row.roundIndex < 1 ||
    row.roundIndex > 5
  ) {
    return null;
  }
  if (!isPlayPhase(row.phase)) return null;
  return {
    active: {
      mode: row.mode,
      roundIndex: row.roundIndex,
      phase: row.phase,
    },
  };
}

let snapshotKey = "";
let snapshot: PracticeHomeDto | null = null;

function snapshotFromStorage(): PracticeHomeDto | null {
  const sessionId = readSessionId();
  if (!sessionId) return null;
  const raw = sessionStorage.getItem(LAST_PRACTICE_HOME_KEY);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { sessionId?: unknown; home?: unknown };
  if (record.sessionId !== sessionId) return null;
  const home = parsePracticeHomeDto(record.home);
  if (home?.active === null) return IDLE_HOME;
  return home;
}

export function readLastPracticeHome(): PracticeHomeDto | null {
  try {
    const sessionId = readSessionId() ?? "";
    const raw = sessionId
      ? (sessionStorage.getItem(LAST_PRACTICE_HOME_KEY) ?? "")
      : "";
    const key = `${sessionId}:${raw}`;
    if (key === snapshotKey) return snapshot;
    snapshotKey = key;
    snapshot = snapshotFromStorage();
    return snapshot;
  } catch {
    snapshotKey = "";
    snapshot = null;
    return null;
  }
}

export function writeLastPracticeHome(home: PracticeHomeDto) {
  const sessionId = readSessionId();
  if (!sessionId) return;
  try {
    sessionStorage.setItem(
      LAST_PRACTICE_HOME_KEY,
      JSON.stringify({ sessionId, home }),
    );
    notify();
  } catch {
    /* private mode / quota */
  }
}

export function clearLastPracticeHome() {
  try {
    sessionStorage.removeItem(LAST_PRACTICE_HOME_KEY);
    notify();
  } catch {
    /* private mode */
  }
}
