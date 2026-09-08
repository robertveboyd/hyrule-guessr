import { isSpRunMode, type SpRunMode } from "@/lib/game/practice";

export const LAST_PRACTICE_MODE_KEY = "hyrule-guessr.practiceMode";
export const DEFAULT_PRACTICE_MODE: SpRunMode = "casual";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeLastPracticeMode(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAST_PRACTICE_MODE_KEY || event.key === null) {
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function readLastPracticeMode(): SpRunMode {
  try {
    const value = localStorage.getItem(LAST_PRACTICE_MODE_KEY);
    return isSpRunMode(value) ? value : DEFAULT_PRACTICE_MODE;
  } catch {
    return DEFAULT_PRACTICE_MODE;
  }
}

export function writeLastPracticeMode(mode: SpRunMode) {
  try {
    localStorage.setItem(LAST_PRACTICE_MODE_KEY, mode);
  } catch {
    /* private mode / quota */
  }
  notify();
}
