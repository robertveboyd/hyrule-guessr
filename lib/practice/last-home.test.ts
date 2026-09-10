import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_STORAGE_KEY } from "@/lib/auth/session-storage";

import {
  LAST_PRACTICE_HOME_KEY,
  clearLastPracticeHome,
  parsePracticeHomeDto,
  readLastPracticeHome,
  writeLastPracticeHome,
} from "./last-home";

const SESSION_A = "11111111-1111-4111-8111-111111111111";
const SESSION_B = "22222222-2222-4111-8111-222222222222";

describe("parsePracticeHomeDto", () => {
  it("accepts idle and an in-progress run", () => {
    expect(parsePracticeHomeDto({ active: null })).toEqual({ active: null });
    expect(
      parsePracticeHomeDto({
        active: { mode: "timed", roundIndex: 2, phase: "reveal" },
      }),
    ).toEqual({
      active: { mode: "timed", roundIndex: 2, phase: "reveal" },
    });
  });

  it("rejects malformed snapshots", () => {
    expect(parsePracticeHomeDto(null)).toBeNull();
    expect(parsePracticeHomeDto({ active: { mode: "ranked" } })).toBeNull();
    expect(
      parsePracticeHomeDto({
        active: { mode: "casual", roundIndex: 0, phase: "guessing" },
      }),
    ).toBeNull();
  });
});

describe("last practice home", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null without a session or snapshot", () => {
    expect(readLastPracticeHome()).toBeNull();
  });

  it("round-trips for the current session id", () => {
    store.set(SESSION_STORAGE_KEY, SESSION_A);
    writeLastPracticeHome({
      active: { mode: "casual", roundIndex: 1, phase: "guessing" },
    });
    expect(readLastPracticeHome()).toEqual({
      active: { mode: "casual", roundIndex: 1, phase: "guessing" },
    });
    expect(readLastPracticeHome()).toBe(readLastPracticeHome());
  });

  it("ignores a snapshot from another session", () => {
    store.set(SESSION_STORAGE_KEY, SESSION_A);
    writeLastPracticeHome({ active: null });
    store.set(SESSION_STORAGE_KEY, SESSION_B);
    expect(readLastPracticeHome()).toBeNull();
    expect(store.get(LAST_PRACTICE_HOME_KEY)).toBeTruthy();
  });

  it("clears the snapshot", () => {
    store.set(SESSION_STORAGE_KEY, SESSION_A);
    writeLastPracticeHome({ active: null });
    clearLastPracticeHome();
    expect(readLastPracticeHome()).toBeNull();
  });
});
