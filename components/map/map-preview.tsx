"use client";

import dynamic from "next/dynamic";

const BotwMap = dynamic(
  () => import("@/components/map/botw-map").then((mod) => mod.BotwMap),
  { ssr: false },
);

export function MapPreview() {
  return <BotwMap />;
}
