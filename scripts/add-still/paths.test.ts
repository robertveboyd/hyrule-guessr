import { describe, expect, it } from "vitest";
import path from "node:path";

import {
  blobStillPathname,
  catalogImageUrl,
  normalizeImageExt,
} from "./paths";

describe("catalogImageUrl", () => {
  const root = path.join("/repo", "public", "catalog");

  it("maps a file under public/catalog to a site path", () => {
    expect(catalogImageUrl(path.join(root, "kakariko.jpg"), root)).toBe(
      "/catalog/kakariko.jpg",
    );
  });

  it("rejects a file outside public/catalog", () => {
    expect(() =>
      catalogImageUrl(path.join("/repo", "secret.jpg"), root),
    ).toThrow("File must be inside public/catalog/.");
  });
});

describe("normalizeImageExt", () => {
  it("treats jpeg as jpg for Blob pathnames", () => {
    expect(normalizeImageExt("shot.JPEG")).toBe(".jpg");
    expect(normalizeImageExt("shot.png")).toBe(".png");
  });
});

describe("blobStillPathname", () => {
  it("uses stills/<content-hash>.ext with no coordinates", () => {
    const hash = "a".repeat(64);
    expect(blobStillPathname(hash, ".jpg")).toBe(`stills/${hash}.jpg`);
    expect(blobStillPathname(hash, ".jpg")).not.toMatch(/-?\d+\.\d+/);
  });
});
