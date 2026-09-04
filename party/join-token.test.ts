import { describe, expect, it } from "vitest";

import {
  JOIN_TOKEN_TTL_SECONDS,
  mintJoinToken,
  secretsEqual,
  verifyJoinToken,
} from "@/party/join-token";

const secret = "test-session-room-secret";
const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

describe("join token", () => {
  it("round-trips userId, sessionId, and expiry", async () => {
    const now = 1_700_000_000_000;
    const token = await mintJoinToken(secret, userId, sessionId, now);
    const claims = await verifyJoinToken(secret, token, now);

    expect(claims).toEqual({
      userId,
      sessionId,
      exp: Math.floor(now / 1000) + JOIN_TOKEN_TTL_SECONDS,
    });
  });

  it("rejects an expired token", async () => {
    const mintedAt = 0;
    const token = await mintJoinToken(secret, userId, sessionId, mintedAt);
    const expMs = JOIN_TOKEN_TTL_SECONDS * 1000;

    expect(await verifyJoinToken(secret, token, expMs)).not.toBeNull();
    expect(await verifyJoinToken(secret, token, expMs + 1000)).toBeNull();
  });

  it("rejects a bad signature and a wrong secret", async () => {
    const token = await mintJoinToken(secret, userId, sessionId);
    const [header, payload, signature] = token.split(".");
    const flipped = signature.endsWith("a")
      ? `${signature.slice(0, -1)}b`
      : `${signature.slice(0, -1)}a`;

    expect(await verifyJoinToken(secret, `${header}.${payload}.${flipped}`)).toBeNull();
    expect(await verifyJoinToken("other-secret", token)).toBeNull();
  });

  it("rejects alg none and malformed tokens before trusting claims", async () => {
    const token = await mintJoinToken(secret, userId, sessionId);
    const [, payload, signature] = token.split(".");
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none" })).toString(
      "base64url",
    );

    expect(
      await verifyJoinToken(secret, `${noneHeader}.${payload}.${signature}`),
    ).toBeNull();
    expect(await verifyJoinToken(secret, "not-a-jwt")).toBeNull();
    expect(await verifyJoinToken(secret, "a.b")).toBeNull();
    expect(await verifyJoinToken(secret, "")).toBeNull();
  });
});

describe("secretsEqual", () => {
  it("compares Bearer secrets", () => {
    expect(secretsEqual(secret, secret)).toBe(true);
    expect(secretsEqual(secret, "nope")).toBe(false);
    expect(secretsEqual("ab", "a")).toBe(false);
  });
});
