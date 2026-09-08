import { notFound } from "next/navigation";

import { MapPreview } from "@/components/map/map-preview";
import { isCatalogMapEnabled } from "@/lib/map/access";

export default function MapPage() {
  if (!isCatalogMapEnabled()) notFound();
  return <MapPreview />;
}
