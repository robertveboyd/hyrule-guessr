import path from "node:path";

export const PUBLIC_CATALOG_DIR = "public/catalog";
export const BLOB_STILLS_PREFIX = "stills";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png"]);

export function catalogImageUrl(file: string, catalogRoot: string): string {
  const resolvedFile = path.resolve(file);
  const resolvedRoot = path.resolve(catalogRoot);
  const relative = path.relative(resolvedRoot, resolvedFile);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File must be inside public/catalog/.");
  }
  return `/catalog/${relative.split(path.sep).join("/")}`;
}

export function normalizeImageExt(file: string): ".jpg" | ".png" {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return ".jpg";
  if (ext === ".png") return ".png";
  throw new Error("Still must be a .jpg or .png file.");
}

export function isAllowedImageFile(file: string): boolean {
  return IMAGE_EXT.has(path.extname(file).toLowerCase());
}

export function blobStillPathname(hash: string, ext: ".jpg" | ".png"): string {
  return `${BLOB_STILLS_PREFIX}/${hash}${ext}`;
}

export function contentTypeForExt(ext: ".jpg" | ".png"): string {
  return ext === ".png" ? "image/png" : "image/jpeg";
}
