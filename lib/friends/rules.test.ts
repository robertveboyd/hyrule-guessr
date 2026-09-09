import { describe, expect, it } from "vitest";

import {
  decideFriendRequest,
  escapeIlike,
  isOnline,
  relationFor,
  toPublicUser,
} from "./rules";
import { PRESENCE_TTL_MS } from "./types";

describe("isOnline", () => {
  it("is false without lastSeenAt", () => {
    expect(isOnline(null)).toBe(false);
  });

  it("is true inside the TTL and false after", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    expect(
      isOnline(new Date(now.getTime() - PRESENCE_TTL_MS + 1), now),
    ).toBe(true);
    expect(isOnline(new Date(now.getTime() - PRESENCE_TTL_MS), now)).toBe(
      false,
    );
  });
});

describe("escapeIlike", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeIlike("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });
});

describe("toPublicUser", () => {
  it("does not include email", () => {
    const dto = toPublicUser({
      id: "u1",
      username: "Link",
      avatarId: "default",
    });
    expect(Object.keys(dto).sort()).toEqual(["avatarId", "id", "username"]);
    expect(JSON.stringify(dto)).not.toMatch(/@/);
  });
});

describe("decideFriendRequest", () => {
  it("rejects self", () => {
    expect(decideFriendRequest("a", "a", null)).toBe("self");
  });

  it("inserts when no pair exists", () => {
    expect(decideFriendRequest("a", "b", null)).toBe("insert");
  });

  it("no-ops a duplicate pending or accepted pair", () => {
    expect(
      decideFriendRequest("a", "b", {
        requesterId: "a",
        addresseeId: "b",
        status: "pending",
      }),
    ).toBe("noop");
    expect(
      decideFriendRequest("a", "b", {
        requesterId: "b",
        addresseeId: "a",
        status: "accepted",
      }),
    ).toBe("noop");
  });

  it("accepts an opposite pending request", () => {
    expect(
      decideFriendRequest("b", "a", {
        requesterId: "a",
        addresseeId: "b",
        status: "pending",
      }),
    ).toBe("accept-opposite");
  });
});

describe("relationFor", () => {
  it("maps pending and accepted pairs", () => {
    expect(relationFor("a", "b", null)).toBe("none");
    expect(
      relationFor("a", "b", {
        requesterId: "a",
        addresseeId: "b",
        status: "pending",
      }),
    ).toBe("outgoing");
    expect(
      relationFor("b", "a", {
        requesterId: "a",
        addresseeId: "b",
        status: "pending",
      }),
    ).toBe("incoming");
    expect(
      relationFor("a", "b", {
        requesterId: "a",
        addresseeId: "b",
        status: "accepted",
      }),
    ).toBe("friends");
  });
});
