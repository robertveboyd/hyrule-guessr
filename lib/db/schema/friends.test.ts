import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FriendshipsUnique } from "./friends";

const migration = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../drizzle/0007_famous_star_brand.sql",
  ),
  "utf8",
);

describe("friendships unique pair", () => {
  it("indexes the unordered least/greatest pair", () => {
    expect(migration).toContain(
      `CREATE UNIQUE INDEX "${FriendshipsUnique.pair}" ON "friendships" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"))`,
    );
  });
});
