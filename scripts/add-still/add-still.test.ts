import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  existingStillAction,
  formatAddStillLog,
  hashStillBytes,
  stillsJsonSchema,
} from "./add-still";

describe("stillsJsonSchema", () => {
  it("accepts an array of file, x, z", () => {
    const parsed = stillsJsonSchema.parse([
      { file: "public/catalog/00001.jpg", x: -1023, z: 1796 },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.file).toBe("public/catalog/00001.jpg");
  });

  it("rejects an empty array", () => {
    expect(stillsJsonSchema.safeParse([]).success).toBe(false);
  });
});

describe("hashStillBytes", () => {
  it("is SHA-256 of the file bytes", () => {
    const body = Buffer.from("still-bytes");
    expect(hashStillBytes(body)).toBe(
      createHash("sha256").update(body).digest("hex"),
    );
  });

  it("changes when the bytes change", () => {
    expect(hashStillBytes(Buffer.from("a"))).not.toBe(
      hashStillBytes(Buffer.from("b")),
    );
  });
});

describe("existingStillAction", () => {
  it("creates when no row has this hash", () => {
    expect(existingStillAction(undefined, { x: 1, z: 2 })).toBe("create");
  });

  it("skips when the same image already has these coordinates", () => {
    expect(existingStillAction({ x: 1, z: 2 }, { x: 1, z: 2 })).toBe("skip");
  });

  it("updates when the same image has different coordinates", () => {
    expect(existingStillAction({ x: 1, z: 2 }, { x: 3, z: 4 })).toBe("update");
  });
});

describe("formatAddStillLog", () => {
  const still = {
    id: "11111111-1111-4111-8111-111111111111",
    imageUrl: "/catalog/00001.jpg",
    x: -1023,
    z: 1796,
  };

  it("describes created, skipped, and updated outcomes", () => {
    expect(formatAddStillLog({ ...still, outcome: "created" }, "dev")).toContain(
      "Created still",
    );
    expect(formatAddStillLog({ ...still, outcome: "skipped" }, "dev")).toContain(
      "same image",
    );
    expect(formatAddStillLog({ ...still, outcome: "updated" }, "dev")).toContain(
      "new coordinates",
    );
  });
});
