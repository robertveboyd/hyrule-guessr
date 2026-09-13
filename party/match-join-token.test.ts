import { describe, expect, it } from "vitest";

import {
  MATCH_JOIN_TOKEN_TTL_SECONDS,
  mintMatchJoinToken,
  verifyMatchJoinToken,
} from "@/party/match-join-token";

const secret = "test-match-room-secret";
const userId = "11111111-1111-4111-8111-111111111111";
const matchId = "33333333-3333-4333-8333-333333333333";

describe("match join token", () => {
  it("round-trips userId, matchId, role, and expiry", async () => {
    const now = 1_700_000_000_000;
    const token = await mintMatchJoinToken(
      secret,
      userId,
      matchId,
      "player_a",
      now,
    );
    const claims = await verifyMatchJoinToken(secret, token, now);
    expect(claims).toEqual({
      userId,
      matchId,
      role: "player_a",
      exp: Math.floor(now / 1000) + MATCH_JOIN_TOKEN_TTL_SECONDS,
    });
  });

  it("rejects an expired token, bad signature, and session-shaped claims", async () => {
    const mintedAt = 0;
    const token = await mintMatchJoinToken(
      secret,
      userId,
      matchId,
      "host_observer",
      mintedAt,
    );
    const expMs = MATCH_JOIN_TOKEN_TTL_SECONDS * 1000;
    expect(await verifyMatchJoinToken(secret, token, expMs)).not.toBeNull();
    expect(await verifyMatchJoinToken(secret, token, expMs + 1000)).toBeNull();
    expect(await verifyMatchJoinToken("other-secret", token)).toBeNull();
  });
});
