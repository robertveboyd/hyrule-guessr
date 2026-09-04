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
    expect(loginPathWithCallback("/map")).toBe("/login?callbackUrl=%2Fmap");
    expect(loginPathWithCallback("/map?z=1")).toBe(
      "/login?callbackUrl=%2Fmap%3Fz%3D1",
    );
  });
});
