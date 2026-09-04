import { describe, expect, it } from "vitest";

import { SESSION_ID_RE, sessionIdsEqual } from "@/lib/auth/session-id";

describe("sessionIdsEqual", () => {
  it("returns true for identical UUIDs", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(sessionIdsEqual(id, id)).toBe(true);
  });

  it("returns false for different same-length ids", () => {
    expect(
      sessionIdsEqual(
        "11111111-1111-4111-8111-111111111111",
        "11111111-1111-4111-8111-111111111112",
      ),
    ).toBe(false);
  });

  it("returns false when lengths differ (does not throw)", () => {
    expect(sessionIdsEqual("abc", "abcd")).toBe(false);
    expect(sessionIdsEqual("", "a")).toBe(false);
  });
});

describe("SESSION_ID_RE", () => {
  it("accepts crypto.randomUUID()", () => {
    expect(SESSION_ID_RE.test(crypto.randomUUID())).toBe(true);
  });

  it("rejects empty, non-UUID, and truncated values", () => {
    expect(SESSION_ID_RE.test("")).toBe(false);
    expect(SESSION_ID_RE.test("not-a-uuid")).toBe(false);
    expect(SESSION_ID_RE.test("11111111-1111-4111-8111-11111111111")).toBe(
      false,
    );
  });
});
