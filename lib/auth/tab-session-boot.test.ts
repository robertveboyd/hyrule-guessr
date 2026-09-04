import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  BOOT_SHA256_SRC,
  tabSessionBootScript,
} from "@/lib/auth/tab-session-boot";

function loadBootSha256() {
  return new Function(`${BOOT_SHA256_SRC}; return sha256;`)() as (
    ascii: string,
  ) => string;
}

function nodeSha256(ascii: string) {
  return createHash("sha256").update(ascii).digest("hex");
}

describe("boot SHA-256", () => {
  it("matches Node createHash for several UUIDs on one sha256 instance", () => {
    const sha256 = loadBootSha256();
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];

    for (const id of ids) {
      expect(sha256(id)).toBe(nodeSha256(id));
    }
  });

  it("injects the hash into the boot script, not the raw UUID", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const hash = nodeSha256(id);
    const script = tabSessionBootScript(hash);

    expect(script).toContain(hash);
    expect(script).not.toContain(id);
  });

  it("rejects a non-hex expected hash", () => {
    const script = tabSessionBootScript("not-a-hash");
    expect(script).toContain('var expected=""');
  });
});
