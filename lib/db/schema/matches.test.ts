import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MatchInvitesUnique, MatchSeatsUnique } from "./matches";

const migration = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../drizzle/0008_first_tempest.sql",
  ),
  "utf8",
);

describe("match unique constraints", () => {
  it("uniques invite per match user and seat role", () => {
    expect(migration).toContain(
      `CONSTRAINT "${MatchInvitesUnique.matchUser}" UNIQUE("match_id","user_id")`,
    );
    expect(migration).toContain(
      `CONSTRAINT "${MatchSeatsUnique.matchRole}" UNIQUE("match_id","role")`,
    );
  });
});
