import { describe, expect, it } from "vitest";

import { loginPathWithCallback } from "@/lib/auth/login-url";

describe("loginPathWithCallback", () => {
  it("omits callbackUrl for home and unsafe targets", () => {
    expect(loginPathWithCallback("/")).toBe("/login");
    expect(loginPathWithCallback(null)).toBe("/login");
    expect(loginPathWithCallback("/login")).toBe("/login");
    expect(loginPathWithCallback("https://evil.example")).toBe("/login");
  });

  it("keeps a gated path and query", () => {
    expect(loginPathWithCallback("/play")).toBe("/login?callbackUrl=%2Fplay");
    expect(loginPathWithCallback("/friends")).toBe(
      "/login?callbackUrl=%2Ffriends",
    );
    expect(loginPathWithCallback("/play?round=1")).toBe(
      "/login?callbackUrl=%2Fplay%3Fround%3D1",
    );
  });
});
