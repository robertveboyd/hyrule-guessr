export const DEFAULT_MAP_TILES_URL = "/maptex/{z}/{x}/{y}.png";

export function mapTilesUrl(): string {
  return process.env.NEXT_PUBLIC_MAP_TILES_URL ?? DEFAULT_MAP_TILES_URL;
}

export function mapBaseImageUrl(tileTemplate = mapTilesUrl()): string {
  return tileTemplate.replace("{z}/{x}/{y}.png", "base.png");
}
