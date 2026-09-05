import { describe, expect, it } from "vitest";

import {
  CRS_TOLERANCE_METERS,
  MAX_NATIVE_ZOOM,
  MAP_HEIGHT_PX,
  MAP_WIDTH_PX,
  clampToMainField,
  distanceMeters,
  gameFromPixelsAtZoom,
  gameToLatLng,
  gameToProjected,
  latLngToGame,
  pixelsAtZoom,
  projectedToGame,
  tileGridAtZoom,
  type GamePoint,
} from "@/lib/game/crs";

/**
 * Named objmap MainField markers. Coordinates are `Translate.X` / `Translate.Z`
 * from https://objmap.zeldamods.org/game_files/map_summary/MainField/static.json
 * (fetched 2026-09-04).
 */
const CRS_LANDMARKS = [
  {
    id: "great-plateau-tower",
    name: "Great Plateau Tower",
    messageId: "Tower07",
    x: -560.03515625,
    z: 1694.86328125,
  },
  {
    id: "ja-baij-shrine",
    name: "Ja Baij Shrine",
    messageId: "Dungeon041",
    x: -447.69512939453125,
    z: 1990.182373046875,
  },
] as const satisfies ReadonlyArray<
  GamePoint & { id: string; name: string; messageId: string }
>;

describe("CRS landmarks", () => {
  it("uses two named objmap fixtures", () => {
    expect(CRS_LANDMARKS).toHaveLength(2);
    expect(CRS_LANDMARKS.map((l) => l.id)).toEqual([
      "great-plateau-tower",
      "ja-baij-shrine",
    ]);
  });

  it("places the two landmarks more than 50 m apart", () => {
    const [tower, shrine] = CRS_LANDMARKS;
    expect(distanceMeters(tower, shrine)).toBeGreaterThan(CRS_TOLERANCE_METERS);
  });
});

describe("pixel ↔ (x, z) round-trip", () => {
  it.each(CRS_LANDMARKS)(
    "$name stays within 50 m after a zoom-7 pixel round-trip",
    (landmark) => {
      const pixels = pixelsAtZoom(landmark, MAX_NATIVE_ZOOM);
      const back = gameFromPixelsAtZoom(pixels, MAX_NATIVE_ZOOM);
      expect(distanceMeters(landmark, back)).toBeLessThan(CRS_TOLERANCE_METERS);
      expect(pixels.x).toBeGreaterThanOrEqual(0);
      expect(pixels.y).toBeGreaterThanOrEqual(0);
      expect(pixels.x).toBeLessThanOrEqual(MAP_WIDTH_PX);
      expect(pixels.y).toBeLessThanOrEqual(MAP_HEIGHT_PX);
    },
  );

  it.each(CRS_LANDMARKS)(
    "$name round-trips projected space and latlng",
    (landmark) => {
      const projected = gameToProjected(landmark);
      expect(distanceMeters(landmark, projectedToGame(projected))).toBeLessThan(
        1e-6,
      );
      const latlng = gameToLatLng(landmark);
      expect(latlng.lat).toBe(landmark.z);
      expect(latlng.lng).toBe(landmark.x);
      expect(latLngToGame(latlng)).toEqual({ x: landmark.x, z: landmark.z });
    },
  );
});

describe("clampToMainField", () => {
  it("clamps outside clicks to the MainField edge", () => {
    expect(clampToMainField({ x: -9000, z: 8000 })).toEqual({
      x: -6000,
      z: 5000,
    });
    expect(clampToMainField({ x: 100, z: 200 })).toEqual({ x: 100, z: 200 });
  });
});

describe("tileGridAtZoom", () => {
  it("matches objmap's native pyramid", () => {
    expect(tileGridAtZoom(0)).toEqual({ cols: 1, rows: 1 });
    expect(tileGridAtZoom(1)).toEqual({ cols: 2, rows: 2 });
    expect(tileGridAtZoom(2)).toEqual({ cols: 3, rows: 3 });
    expect(tileGridAtZoom(7)).toEqual({ cols: 94, rows: 79 });
  });
});
