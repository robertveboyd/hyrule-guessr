"use client";

import { BotwLeaflet } from "@/components/map/botw-leaflet";
import { cn } from "@/lib/utils";
import type { GamePoint } from "@/lib/game/crs";
import type { ReactNode } from "react";

export function GuessMap({
  guess,
  truth = null,
  interactive,
  expanded,
  onGuess,
  onPointerEnter,
  onPointerLeave,
  onActivate,
  footer,
}: {
  guess: GamePoint | null;
  truth?: GamePoint | null;
  interactive: boolean;
  expanded: boolean;
  onGuess: (point: GamePoint) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onActivate?: () => void;
  footer: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute right-3 bottom-3 z-20 flex flex-col overflow-hidden rounded-md border border-amber/40 bg-hud shadow-[0_8px_40px_rgb(0_0_0_/_.55)] transition-[width,height] duration-200 ease-out",
        expanded
          ? "h-[min(38rem,calc(100%-1.5rem))] w-[min(52rem,72vw)]"
          : "h-40 w-52 sm:h-48 sm:w-72",
      )}
      aria-expanded={expanded}
      aria-label="Guess map"
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="relative min-h-0 flex-1"
        onPointerDown={onActivate}
      >
        <BotwLeaflet
          className="h-full w-full"
          guess={guess}
          truth={truth}
          guessKind="guess"
          interactive={interactive}
          onGuess={onGuess}
          showLine={Boolean(guess && truth)}
          showZoom={expanded}
          visible={expanded}
        />
      </div>
      <div className="flex w-full shrink-0 flex-col gap-1.5 bg-hud px-2 py-1.5">
        {footer}
      </div>
    </div>
  );
}
