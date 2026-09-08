import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PRACTICE_MODE,
  LAST_PRACTICE_MODE_KEY,
  readLastPracticeMode,
  writeLastPracticeMode,
} from "./last-mode";

describe("last practice mode", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to casual", () => {
    expect(readLastPracticeMode()).toBe(DEFAULT_PRACTICE_MODE);
  });

  it("ignores unknown values", () => {
    store.set(LAST_PRACTICE_MODE_KEY, "ranked");
    expect(readLastPracticeMode()).toBe("casual");
  });

  it("round-trips timed", () => {
    writeLastPracticeMode("timed");
    expect(readLastPracticeMode()).toBe("timed");
  });
});
