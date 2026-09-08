import { describe, expect, it } from "vitest";

import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";

describe("safeCallbackUrl", () => {
  it("keeps a same-origin path and query", () => {
    expect(safeCallbackUrl("/play")).toBe("/play");
    expect(safeCallbackUrl("/play?round=1")).toBe("/play?round=1");
    expect(safeCallbackUrl("/play?round=2&x=1")).toBe("/play?round=2&x=1");
  });

  it("drops the hash", () => {
    expect(safeCallbackUrl("/play#frag")).toBe("/play");
  });

  it("falls back for /login after normalization", () => {
    expect(safeCallbackUrl("/login")).toBe("/");
    expect(safeCallbackUrl("/login?x=1")).toBe("/");
    expect(safeCallbackUrl("/foo/../login")).toBe("/");
  });

  it("rejects open redirects", () => {
    expect(safeCallbackUrl("https://evil.example")).toBe("/");
    expect(safeCallbackUrl("//evil.example")).toBe("/");
    expect(safeCallbackUrl("/\\evil.example")).toBe("/");
  });

  it("falls back for empty, non-strings, and default /", () => {
    expect(safeCallbackUrl("")).toBe("/");
    expect(safeCallbackUrl(undefined)).toBe("/");
    expect(safeCallbackUrl(["/play"])).toBe("/");
    expect(safeCallbackUrl("/")).toBe("/");
  });
});
