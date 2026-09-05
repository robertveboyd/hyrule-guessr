import { notFound } from "next/navigation";

import { MapPreview } from "@/components/map/map-preview";

export default function MapPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MapPreview />;
}
