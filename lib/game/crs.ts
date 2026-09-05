/**
 * BotW overworld CRS, matching objmap (`zeldamods/objmap`).
 *
 * Leaflet `lat` = game Z, `lng` = game X.
 * Transform coefficients copy MapBase.ts + util/map.ts (TILE_SIZE 256,
 * MAP_SIZE [24000, 20000], L.Transformation(4/256, 24000/256, 4/256, 20000/256)).
 *
 * +X east, +Z south (north is up on the map). Y (height) is ignored.
 */

export const TILE_SIZE = 256;
export const MAP_WIDTH_PX = 24000;
export const MAP_HEIGHT_PX = 20000;

export const MIN_ZOOM = 2;
export const MAX_NATIVE_ZOOM = 7;
/** Stop at native tile zoom; do not overzoom like objmap (max 10). */
export const MAX_ZOOM = MAX_NATIVE_ZOOM;
export const DEFAULT_ZOOM = 3;

/** MainField extent used by objmap `isValidXYZ`. */
export const WORLD_X_MIN = -6000;
export const WORLD_X_MAX = 6000;
export const WORLD_Z_MIN = -5000;
export const WORLD_Z_MAX = 5000;

export const CRS_TOLERANCE_METERS = 50;

const TRANSFORM_A = 4 / TILE_SIZE;
const TRANSFORM_B = MAP_WIDTH_PX / TILE_SIZE;
const TRANSFORM_C = 4 / TILE_SIZE;
const TRANSFORM_D = MAP_HEIGHT_PX / TILE_SIZE;

export const CRS_TRANSFORM = {
  a: TRANSFORM_A,
  b: TRANSFORM_B,
  c: TRANSFORM_C,
  d: TRANSFORM_D,
} as const;

export type GamePoint = { x: number; z: number };
export type LatLng = { lat: number; lng: number };
export type ProjectedPoint = { x: number; y: number };

export function gameToLatLng(point: GamePoint): LatLng {
  return { lat: point.z, lng: point.x };
}

export function latLngToGame(latlng: LatLng): GamePoint {
  return { x: latlng.lng, z: latlng.lat };
}

export function gameToProjected(point: GamePoint): ProjectedPoint {
  return {
    x: TRANSFORM_A * point.x + TRANSFORM_B,
    y: TRANSFORM_C * point.z + TRANSFORM_D,
  };
}

export function projectedToGame(point: ProjectedPoint): GamePoint {
  return {
    x: (point.x - TRANSFORM_B) / TRANSFORM_A,
    z: (point.y - TRANSFORM_D) / TRANSFORM_C,
  };
}

export function pixelsAtZoom(point: GamePoint, zoom: number): ProjectedPoint {
  const scale = 2 ** zoom;
  const projected = gameToProjected(point);
  return { x: scale * projected.x, y: scale * projected.y };
}

export function gameFromPixelsAtZoom(
  pixels: ProjectedPoint,
  zoom: number,
): GamePoint {
  const scale = 2 ** zoom;
  return projectedToGame({ x: pixels.x / scale, y: pixels.y / scale });
}

export function clampToMainField(point: GamePoint): GamePoint {
  return {
    x: Math.min(WORLD_X_MAX, Math.max(WORLD_X_MIN, point.x)),
    z: Math.min(WORLD_Z_MAX, Math.max(WORLD_Z_MIN, point.z)),
  };
}

export function distanceMeters(a: GamePoint, b: GamePoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function mainFieldLatLngBounds(): {
  southWest: LatLng;
  northEast: LatLng;
} {
  return {
    southWest: gameToLatLng({ x: WORLD_X_MIN, z: WORLD_Z_MAX }),
    northEast: gameToLatLng({ x: WORLD_X_MAX, z: WORLD_Z_MIN }),
  };
}

export function tileGridAtZoom(zoom: number): { cols: number; rows: number } {
  const factor = 2 ** (zoom - MAX_NATIVE_ZOOM);
  return {
    cols: Math.max(1, Math.ceil((MAP_WIDTH_PX * factor) / TILE_SIZE)),
    rows: Math.max(1, Math.ceil((MAP_HEIGHT_PX * factor) / TILE_SIZE)),
  };
}
