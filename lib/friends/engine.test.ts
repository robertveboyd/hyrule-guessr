import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const engine = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "engine.ts"),
  "utf8",
);

describe("searchUsers", () => {
  it("does not select email", () => {
    const start = engine.indexOf("export async function searchUsers");
    const end = engine.indexOf("export async function requestFriend");
    const body = engine.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(body).toContain("id: users.id");
    expect(body).toContain("username: users.username");
    expect(body).toContain("avatarId: users.avatarId");
    expect(body).not.toMatch(/email/);
  });
});
