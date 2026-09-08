"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import type { GamePoint } from "@/lib/game/crs";

const BotwLeaflet = dynamic(
  () => import("@/components/map/botw-leaflet").then((mod) => mod.BotwLeaflet),
  { ssr: false },
);

function formatCoord(value: number) {
  return value.toFixed(2);
}

export function MapPreview() {
  const [point, setPoint] = useState<GamePoint | null>(null);

  return (
    <div className="flex h-svh flex-col bg-black">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-hud px-4 py-2">
        <p className="font-mono text-sm text-foreground">
          {point
            ? `x ${formatCoord(point.x)}, z ${formatCoord(point.z)}`
            : "Click the map for BotW (x, z)"}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/">Home</Link>
          </Button>
          <SignOutButton size="sm" />
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <BotwLeaflet
          className="absolute inset-0"
          interactive
          visible
          guess={point}
          onGuess={setPoint}
          guessKind="preview"
          showZoom
        />
      </div>
    </div>
  );
}
