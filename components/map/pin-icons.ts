export type PinKind = "preview" | "guess" | "truth" | "opponent";

export type PinArt = {
  src: string;
  className: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
};

/** Kit flare artboard is 70×235; stamp center sits at (35, 200). */
const BEACON_SIZE: [number, number] = [42, 141];
const BEACON_ANCHOR: [number, number] = [21, 120];
/** Kit quest marker is 75×75 with rings centered at (37.5, 37.5). */
const QUEST_SIZE: [number, number] = [48, 48];
const QUEST_ANCHOR: [number, number] = [24, 24];

function beaconArt(src: string, tone: "red" | "blue"): PinArt {
  return {
    src,
    className: `botw-map-pin botw-map-pin-stamp botw-map-pin-stamp-${tone}`,
    iconSize: BEACON_SIZE,
    iconAnchor: BEACON_ANCHOR,
  };
}

export function pinArt(kind: PinKind): PinArt {
  if (kind === "truth") {
    return {
      src: "/kit/map-quest.svg",
      className: "botw-map-pin botw-map-pin-quest",
      iconSize: QUEST_SIZE,
      iconAnchor: QUEST_ANCHOR,
    };
  }
  if (kind === "opponent") {
    return beaconArt("/kit/map-pin-blue.svg?v=4", "blue");
  }
  return beaconArt("/kit/map-pin-red.svg?v=4", "red");
}

export function pinLineColor(kind: Exclude<PinKind, "truth" | "preview">) {
  return kind === "opponent" ? "#9DAAFE" : "#FF8964";
}
