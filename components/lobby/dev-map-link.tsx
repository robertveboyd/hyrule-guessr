"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { isCatalogMapEnabled } from "@/lib/map/access";

export function DevMapLink({ className }: { className?: string }) {
  if (!isCatalogMapEnabled()) return null;
  return (
    <Button asChild variant="outline" className={className}>
      <Link href="/map">Map</Link>
    </Button>
  );
}
