import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

import {
  clearLoginFailures,
  isLoginRateLimited,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";

const email = "rate-limit@test.example";
const ip = "203.0.113.1";

describe("login rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    clearLoginFailures(email, ip);
  });

  afterEach(() => {
    clearLoginFailures(email, ip);
    vi.useRealTimers();
  });

  it("allows four failures and blocks the fifth window", () => {
    for (let i = 0; i < 4; i++) {
      recordLoginFailure(email, ip);
      expect(isLoginRateLimited(email, ip)).toBe(false);
    }

    recordLoginFailure(email, ip);
    expect(isLoginRateLimited(email, ip)).toBe(true);
  });

  it("clears on success", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure(email, ip);
    expect(isLoginRateLimited(email, ip)).toBe(true);

    clearLoginFailures(email, ip);
    expect(isLoginRateLimited(email, ip)).toBe(false);
  });

  it("expires entries after 15 minutes", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure(email, ip);
    expect(isLoginRateLimited(email, ip)).toBe(true);

    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(isLoginRateLimited(email, ip)).toBe(false);
  });
});
